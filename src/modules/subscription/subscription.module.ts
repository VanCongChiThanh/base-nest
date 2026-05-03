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

@Module({
  imports: [
    forwardRef(() => PaymentModule),
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
