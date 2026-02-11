import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UserService } from '../../user/user.service';
import { User } from '../../user/entities';
import * as bcrypt from 'bcrypt';
import { AUTH_ERRORS, UnauthorizedException } from '../../../common';

/**
 * Local Strategy - verify via email/password
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      usernameField: 'email',
    });
  }

  /**
   * Validate user credentials
   * Passport auto call this method
   */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException(AUTH_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    // check user have password (Google account then no password)
    if (!user.password) {
      throw new UnauthorizedException(AUTH_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(AUTH_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    return user;
  }
}
