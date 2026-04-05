import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PaymentOrder,
  SubscriptionPlan,
  UsageCounter,
  UserSubscription,
} from './entities';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      UserSubscription,
      UsageCounter,
      PaymentOrder,
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [TypeOrmModule, SubscriptionService],
})
export class SubscriptionModule {}
