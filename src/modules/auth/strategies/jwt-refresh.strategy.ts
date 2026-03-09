import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { ConfigType } from '@nestjs/config';
import { Request } from 'express';
import { AUTH_ERRORS, UnauthorizedException } from '../../../common';
import jwtConfig from '../../../config/jwt.config';

/**
 * JWT Refresh Token Strategy
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @Inject(jwtConfig.KEY)
    jwtConf: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: jwtConf.refreshSecret,
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
