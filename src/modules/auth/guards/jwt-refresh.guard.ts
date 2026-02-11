import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard cho JWT Refresh Token
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
