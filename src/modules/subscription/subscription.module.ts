import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PaymentOrder,
  SubscriptionPlan,
  UsageCounter,
  UserSubscription,
} from './entities';
import { User } from '../user/entities';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PaymentModule } from '../payment/payment.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    forwardRef(() => PaymentModule),
    NotificationModule,
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      UserSubscription,
      UsageCounter,
      PaymentOrder,
      User,
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [TypeOrmModule, SubscriptionService],
})
export class SubscriptionModule {}
