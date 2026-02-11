import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators';
import { AUTH_ERRORS } from '../constants';

/**
 * JWT Authentication Guard
 * Auto skip authentication for endpoints marked with @Public()
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if endpoint is marked with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Override to throw custom error with errorCode
   */
  handleRequest<TUser = any>(
    err: Error | null,
    user: TUser | false,
    info: Error | null,
  ): TUser {
    if (err || !user) {
      // Token expired
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException(AUTH_ERRORS.AUTH_TOKEN_EXPIRED);
      }
      // Token invalid or missing token
      throw new UnauthorizedException(AUTH_ERRORS.AUTH_TOKEN_INVALID);
    }
    return user;
  }
}
