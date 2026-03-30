import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import { JobService } from './job.service';
import { ApplicationChatService } from './application-chat.service';
import { ApplicationChatGateway } from './application-chat.gateway';
import { JobController } from './job.controller';
import {
  Job,
  JobSkill,
  JobApplication,
  JobAssignment,
  ApplicationMessage,
} from './entities';
import { NotificationModule } from '../notification';
import { EmployerProfile, WorkerProfile } from '../profile/entities';
import { UserModule } from '../user/user.module';
import jwtConfig from '../../config/jwt.config';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwtConf: ConfigType<typeof jwtConfig>) => ({
        secret: jwtConf.accessSecret,
      }),
    }),
    TypeOrmModule.forFeature([
      Job,
      JobSkill,
      JobApplication,
      JobAssignment,
      ApplicationMessage,
      EmployerProfile,
      WorkerProfile,
    ]),
    NotificationModule,
    UserModule,
  ],
  controllers: [JobController],
  providers: [JobService, ApplicationChatService, ApplicationChatGateway],
  exports: [JobService, ApplicationChatService],
})
export class JobModule {}
