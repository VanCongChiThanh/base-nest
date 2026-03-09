import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserProvider } from './entities';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';
import jwtConfig from '../../config/jwt.config';
import { LocalStrategy, JwtStrategy, JwtRefreshStrategy } from './strategies';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([UserProvider]),
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwtConf: ConfigType<typeof jwtConfig>) => ({
        secret: jwtConf.accessSecret,
        signOptions: {
          expiresIn: 900, // 15 minutes in seconds
        },
      }),
    }),
    UserModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
