import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigType } from '@nestjs/config';
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
import { RedisModule } from './modules/redis';

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
      inject: [databaseConfig.KEY],
      useFactory: (dbConf: ConfigType<typeof databaseConfig>) => ({
        type: dbConf.type,
        host: dbConf.host,
        port: dbConf.port,
        username: dbConf.username,
        password: dbConf.password,
        database: dbConf.database,
        autoLoadEntities: true,
        synchronize: dbConf.synchronize,
        logging: dbConf.logging,
      }),
    }),

    // Feature Modules
    RedisModule,
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
