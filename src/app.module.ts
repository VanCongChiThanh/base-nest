import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'node:path';

// Config imports
import {
  databaseConfig,
  redisConfig,
  jwtConfig,
  googleConfig,
  awsConfig,
  mailConfig,
  ekycConfig,
  payosConfig,
} from './config';

// Common imports
import { EntitlementGuard, JwtAuthGuard, RolesGuard } from './common/guards';

// Module imports
import { UserModule } from './modules/user';
import { AuthModule } from './modules/auth';
import { NotificationModule } from './modules/notification';
import { UploadModule } from './modules/upload';
import { MailModule } from './modules/mail';
import { RedisModule } from './modules/redis';
import { LocationModule } from './modules/location';
import { SkillModule } from './modules/skill';
import { JobCategoryModule } from './modules/job-category';
import { ProfileModule } from './modules/profile';
import { JobModule } from './modules/job';
import { ReviewModule } from './modules/review';
import { ReportModule } from './modules/report';
import { PaymentModule } from './modules/payment';
import { VerificationModule } from './modules/verification';
import { SubscriptionModule } from './modules/subscription';
import { EkycModule } from './modules/ekyc';

@Module({
  imports: [
    // Config Module - Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../.env')],
      load: [
        databaseConfig,
        redisConfig,
        jwtConfig,
        googleConfig,
        awsConfig,
        mailConfig,
        ekycConfig,
        payosConfig,
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
    LocationModule,
    SkillModule,
    JobCategoryModule,
    ProfileModule,
    JobModule,
    ReviewModule,
    ReportModule,
    PaymentModule,
    VerificationModule,
    SubscriptionModule,
    EkycModule,
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
    // Global Entitlement Guard - chỉ chạy khi endpoint có metadata entitlement
    {
      provide: APP_GUARD,
      useClass: EntitlementGuard,
    },
  ],
})
export class AppModule {}
