import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { UserService } from '../../modules/user/user.service';
import { AUTH_ERRORS, USER_ERRORS } from '../constants';
import jwtConfig from '../../config/jwt.config';

/**
 * Guard for SSE - get token from query param
 * SSE (EventSource) does not support custom headers, so query param must be used
 */
@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConf: ConfigType<typeof jwtConfig>,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get token from query param or authorization header
    const token =
      request.query.token ||
      request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException(AUTH_ERRORS.AUTH_TOKEN_INVALID);
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.jwtConf.accessSecret,
      });

      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException(USER_ERRORS.USER_NOT_FOUND);
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException(AUTH_ERRORS.AUTH_TOKEN_INVALID);
    }
  }
}
