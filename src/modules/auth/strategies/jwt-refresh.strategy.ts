import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AUTH_ERRORS, UnauthorizedException } from '../../../common';

/**
 * JWT Refresh Token Strategy
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.refreshSecret') ||
        'default-refresh-secret',
      passReqToCallback: true,
    });
  }

  /**
   * Validate refresh token
   */
  async validate(req: Request, payload: { sub: string; email: string }) {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(AUTH_ERRORS.AUTH_INVALID_REFRESH_TOKEN);
    }

    return { id: payload.sub, email: payload.email, refreshToken };
  }
}
