import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  TokenResponseDto,
} from './dto';
import { LocalAuthGuard, JwtRefreshGuard, GoogleAuthGuard } from './guards';
import { Public, CurrentUser } from '../../common/decorators';
import { User } from '../user/entities';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /auth/register - Register a new account
   */
  @Public()
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<{ message: string }> {
    return this.authService.register(registerDto);
  }

  /**
   * POST /auth/login - Login
   */
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@CurrentUser() user: User): Promise<TokenResponseDto> {
    return this.authService.login(user);
  }

  /**
   * POST /auth/refresh - Refresh tokens
   */
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refreshTokens(
    @Body() refreshTokenDto: RefreshTokenDto,
    @CurrentUser() user: User,
  ): Promise<TokenResponseDto> {
    return this.authService.refreshTokens(
      user.id,
      refreshTokenDto.refreshToken,
    );
  }

  /**
   * POST /auth/logout - Logout
   */
  @Post('logout')
  async logout(
    @CurrentUser() user: User,
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<{ message: string }> {
    return this.authService.logout(user.id, refreshTokenDto.refreshToken);
  }

  /**
   * GET /auth/verify-email - Verify email
   */
  @Public()
  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
  ): Promise<{ message: string }> {
    return this.authService.verifyEmail(token);
  }

  /**
   * POST /auth/forgot-password - Request password reset
   */
  @Public()
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  /**
   * POST /auth/reset-password - Reset password
   */
  @Public()
  @Post('reset-password')
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  /**
   * GET /auth/google - Redirect to google for authentication
   */
  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleAuth() {
    // Guard will redirect to google
  }

  /**
   * GET /auth/google/callback - Callback from google
   */
  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthCallback(@CurrentUser() user: User, @Res() res: Response) {
    // Handle Google user and create tokens
    const validatedUser = await this.authService.validateGoogleUser(user);
    const tokens = await this.authService.login(validatedUser);

    // Redirect to frontend with tokens
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;

    res.redirect(redirectUrl);
  }
}
