import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

// Config imports
import {
  databaseConfig,
  redisConfig,
  jwtConfig,
  googleConfig,
  awsConfig,
  mailConfig,
} from './config';

// Common imports
import { JwtAuthGuard, RolesGuard } from './common/guards';

// Module imports
import { UserModule } from './modules/user';
import { AuthModule } from './modules/auth';
import { NotificationModule } from './modules/notification';
import { UploadModule } from './modules/upload';
import { MailModule } from './modules/mail';

@Module({
  imports: [
    // Config Module - Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        redisConfig,
        jwtConfig,
        googleConfig,
        awsConfig,
        mailConfig,
      ],
    }),

    // TypeORM Module - Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: false,
      }),
    }),

    // Feature Modules
    UserModule,
    AuthModule,
    NotificationModule,
    UploadModule,
    MailModule,
  ],
  providers: [
    // Global JWT Guard - Áp dụng cho tất cả endpoints (trừ @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Roles Guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
