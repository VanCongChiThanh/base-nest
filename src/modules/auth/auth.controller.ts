import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  TokenResponseDto,
} from './dto';
import { LocalAuthGuard, JwtRefreshGuard } from './guards';
import { Public, CurrentUser } from '../../common/decorators';
import { User } from '../user/entities';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
   * POST /auth/google/id-token - Verify Google ID token from popup/One Tap
   */
  @Public()
  @Post('google/id-token')
  async googleIdTokenLogin(
    @Body('idToken') idToken: string,
  ): Promise<TokenResponseDto> {
    return this.authService.verifyGoogleIdToken(idToken);
  }
}
