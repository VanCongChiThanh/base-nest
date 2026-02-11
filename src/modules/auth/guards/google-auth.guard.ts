import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard cho Google OAuth
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
