import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CONSUME_QUOTAS_KEY,
  ConsumeQuotaConfig,
  REQUIRED_FEATURES_KEY,
  RequiredFeatureConfig,
} from '../decorators';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { User } from '../../modules/user/entities';
import { ForbiddenException } from '../exceptions/business.exception';
import { SUBSCRIPTION_ERRORS } from '../constants/error-codes.constant';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures =
      this.reflector.getAllAndMerge<RequiredFeatureConfig[]>(
        REQUIRED_FEATURES_KEY,
        [context.getHandler(), context.getClass()],
      ) || [];
    const consumeQuotas =
      this.reflector.getAllAndMerge<ConsumeQuotaConfig[]>(CONSUME_QUOTAS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredFeatures.length === 0 && consumeQuotas.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as User | undefined;

    if (!user) {
      return false;
    }

    if (requiredFeatures.length > 0) {
      const entitlements =
        await this.subscriptionService.getEntitlementsForUser(user);

      for (const requirement of requiredFeatures) {
        const value = entitlements.features?.[requirement.key];

        if (requirement.equals !== undefined) {
          if (value !== requirement.equals) {
            throw new ForbiddenException(SUBSCRIPTION_ERRORS.FEATURE_NOT_AVAILABLE);
          }
          continue;
        }

        if (!value) {
          throw new ForbiddenException(SUBSCRIPTION_ERRORS.FEATURE_NOT_ENABLED);
        }
      }
    }


    for (const quota of consumeQuotas) {
      await this.subscriptionService.consumeQuota(user, quota);
    }

    return true;
  }
}
