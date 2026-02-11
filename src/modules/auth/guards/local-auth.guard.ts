import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard cho Local Strategy (email/password login)
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
