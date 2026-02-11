import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { UserService } from '../user/user.service';
import { User } from '../user/entities';
import { RegisterDto, TokenResponseDto } from './dto';
import { MailService } from '../mail/mail.service';
import {
  UnauthorizedException,
  BadRequestException,
  AUTH_ERRORS,
} from '../../common';

@Injectable()
export class AuthService {
  private readonly redis: Redis;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    // Initialize Redis connection
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host') || 'localhost',
      port: this.configService.get<number>('redis.port') || 6379,
    });
  }

  /**
   * Register new user
   */
  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    // Create user
    const user = await this.userService.create({
      email: registerDto.email,
      password: registerDto.password,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    // Create verification token
    const verificationToken = uuidv4();
    await this.userService.updateInternal(user.id, { verificationToken });

    // Send verification email
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  /**
   * Login - return tokens
   */
  async login(user: User): Promise<TokenResponseDto> {
    const tokens = await this.generateTokens(user);

    // Save refresh token to Redis
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(
    userId: string,
    oldRefreshToken: string,
  ): Promise<TokenResponseDto> {
    // Validate refresh token is still valid in Redis
    const isValid = await this.validateRefreshToken(userId, oldRefreshToken);
    if (!isValid) {
      throw new UnauthorizedException(AUTH_ERRORS.AUTH_INVALID_REFRESH_TOKEN);
    }

    const user = await this.userService.findById(userId);

    // Remove old refresh token (token rotation)
    await this.removeRefreshToken(userId, oldRefreshToken);

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    // Save new refresh token to Redis
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logout - remove refresh token
   */
  async logout(
    userId: string,
    refreshToken: string,
  ): Promise<{ message: string }> {
    await this.removeRefreshToken(userId, refreshToken);
    return { message: 'Logout successful' };
  }

  /**
   * Validate Google user and register/login accordingly
   */
  async validateGoogleUser(googleUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  }): Promise<User> {
    // Find user by Google ID
    let user = await this.userService.findByGoogleId(googleUser.googleId);

    if (user) {
      return user;
    }

    // Find user by email
    user = await this.userService.findByEmail(googleUser.email);

    if (user) {
      // Link Google account with the current user
      await this.userService.updateInternal(user.id, {
        googleId: googleUser.googleId,
        avatarUrl: googleUser.avatarUrl || undefined,
        isEmailVerified: true, // Email from Google is verified
      });
      return this.userService.findById(user.id);
    }

    // Tạo user mới với email đã verified
    const newUser = await this.userService.create({
      email: googleUser.email,
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      googleId: googleUser.googleId,
      avatarUrl: googleUser.avatarUrl || undefined,
    });

    // Mark email as verified for Google users
    await this.userService.updateInternal(newUser.id, {
      isEmailVerified: true,
    });

    return this.userService.findById(newUser.id);
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    // Find user with verification token
    const user = await this.userService.findByVerificationToken(token);

    if (!user) {
      throw new BadRequestException(
        AUTH_ERRORS.AUTH_INVALID_VERIFICATION_TOKEN,
      );
    }

    // Update user
    await this.userService.updateInternal(user.id, {
      isEmailVerified: true,
      verificationToken: undefined,
    });

    return { message: 'Email verification successful' };
  }

  /**
   * Forgot password - send reset email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    // Do not reveal whether the email exists or not
    if (!user) {
      return {
        message: 'If the email exists, you will receive a password reset link',
      };
    }

    // Tạo reset token
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userService.updateInternal(user.id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetExpires,
    });

    // Gửi email
    await this.mailService.sendResetPasswordEmail(user.email, resetToken);

    return {
      message: 'If the email exists, you will receive a password reset link',
    };
  }

  /**
   * Reset password
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByResetPasswordToken(token);

    if (!user) {
      throw new BadRequestException(AUTH_ERRORS.AUTH_INVALID_RESET_TOKEN);
    }

    // Check if token has expired
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException(AUTH_ERRORS.AUTH_TOKEN_EXPIRED);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.userService.updateInternal(user.id, {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });

    // Remove all refresh tokens of the user (force logout)
    await this.removeAllRefreshTokens(user.id);

    return { message: 'Password reset successful' };
  }

  /**
   * Validate refresh token in Redis
   */
  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const storedToken = await this.redis.get(`refresh:${userId}:${token}`);
    return storedToken === token;
  }

  // ========== Private Methods ==========

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: User): Promise<TokenResponseDto> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessExpirationStr =
      this.configService.get<string>('jwt.accessExpiration') || '15m';
    const refreshExpirationStr =
      this.configService.get<string>('jwt.refreshExpiration') || '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.parseExpirationToSeconds(accessExpirationStr),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.parseExpirationToSeconds(refreshExpirationStr),
    });

    return new TokenResponseDto({
      accessToken,
      refreshToken,
      expiresIn: accessExpirationStr,
    });
  }

  /**
   * Save refresh token to Redis
   */
  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const expiresIn =
      this.configService.get<string>('jwt.refreshExpiration') || '7d';
    const seconds = this.parseExpirationToSeconds(expiresIn);

    await this.redis.set(`refresh:${userId}:${token}`, token, 'EX', seconds);
  }

  /**
   * Remove refresh token from Redis
   */
  private async removeRefreshToken(
    userId: string,
    token: string,
  ): Promise<void> {
    await this.redis.del(`refresh:${userId}:${token}`);
  }

  /**
   * Remove all refresh tokens of the user
   */
  private async removeAllRefreshTokens(userId: string): Promise<void> {
    const keys = await this.redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Parse expiration string to seconds
   */
  private parseExpirationToSeconds(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 7 * 24 * 60 * 60; // Default 7 days
    }
  }
}
