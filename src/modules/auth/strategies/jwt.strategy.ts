import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { ConfigType } from '@nestjs/config';
import { UserService } from '../../user/user.service';
import { USER_ERRORS, UnauthorizedException } from '../../../common';
import jwtConfig from '../../../config/jwt.config';

/**
 * JWT Access Token Strategy
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(jwtConfig.KEY)
    jwtConf: ConfigType<typeof jwtConfig>,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConf.accessSecret,
    });
  }

  /**
   * Validate JWT payload and return user
   */
  async validate(payload: { sub: string; email: string }) {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException(USER_ERRORS.USER_NOT_FOUND);
    }
    return user;
  }
}
