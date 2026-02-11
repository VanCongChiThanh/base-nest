import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationHelper } from './notification.helper';
import { Notification } from './entities';
import { UserModule } from '../user/user.module';
import { SseAuthGuard } from '../../common/guards';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), UserModule, JwtModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationHelper, SseAuthGuard],
  exports: [NotificationService, NotificationHelper],
})
export class NotificationModule {}
