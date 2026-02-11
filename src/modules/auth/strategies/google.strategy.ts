import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

/**
 * Google OAuth Strategy
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('google.clientId') || '',
      clientSecret: configService.get<string>('google.clientSecret') || '',
      callbackURL: configService.get<string>('google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  /**
   * Callback after Google OAuth verify success
   * returns google user data
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    const googleUser = {
      googleId: id,
      email: emails[0].value,
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      avatarUrl: photos?.[0]?.value || null,
    };

    done(null, googleUser);
  }
}
