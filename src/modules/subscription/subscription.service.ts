import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PayOS } from '@payos/node';
import { createHmac } from 'node:crypto';
import { Repository } from 'typeorm';
import {
  PlanCode,
  PlanScope,
  Role,
  SubscriptionStatus,
  VerificationLevel,
} from '../../common/enums';
import payosConfig from '../../config/payos.config';
import { User } from '../user/entities';
import { ConsumeQuotaConfig } from '../../common/decorators';
import { AssignPlanDto } from './dto';
import {
  PaymentOrder,
  PaymentOrderStatus,
  SubscriptionPlan,
  UsageCounter,
  UserSubscription,
} from './entities';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '../../common/exceptions/business.exception';
import {
  RESOURCE_ERRORS,
  SUBSCRIPTION_ERRORS,
  USER_ERRORS,
} from '../../common/constants/error-codes.constant';
import { NotificationService } from '../notification/notification.service';
import { EscrowService } from '../payment/escrow.service';

type EntitlementValue = boolean | number | string | null;

interface PlanSeed {
  code: PlanCode;
  name: string;
  scope: PlanScope;
  price: number;
  isActive: boolean;
  maxPostsPerMonth: number;
  postExpiryDays: number;
  featuredPosts: number;
  featureConfig: Record<string, EntitlementValue>;
}

const PLAN_SEEDS: PlanSeed[] = [
  {
    code: PlanCode.FREE,
    name: 'Free',
    scope: PlanScope.EMPLOYER,
    price: 0,
    isActive: true,
    maxPostsPerMonth: 2,
    postExpiryDays: 14,
    featuredPosts: 0,
    featureConfig: {
      'job.post.max_open_jobs': 1,
      'job.apply.daily_limit': 5,
      'chat.enabled': true,
      'ekyc.required_for_sensitive_jobs': true,
      'ai.job_chatbot.enabled': false,
      'ai.cv_screening.enabled': false,
      'ai.cv_screening.monthly_quota': 0,
      'worker.service.active_limit': 1,
    },
  },
  {
    code: PlanCode.PRO,
    name: 'Pro',
    scope: PlanScope.EMPLOYER,
    price: 59000,
    isActive: true,
    maxPostsPerMonth: 10,
    postExpiryDays: 30,
    featuredPosts: 1,
    featureConfig: {
      'job.post.max_open_jobs': 10,
      'job.apply.daily_limit': 9999,
      'chat.enabled': true,
      'ekyc.required_for_sensitive_jobs': true,
      'ai.job_chatbot.enabled': true,
      'ai.cv_screening.enabled': true,
      'ai.cv_screening.monthly_quota': 50,
      'ai.interview_summary.enabled': true,
      'worker.service.active_limit': 10,
    },
  },
  {
    code: PlanCode.BUSINESS_LITE,
    name: 'Employee Basic',
    scope: PlanScope.ORGANIZATION,
    price: 0,
    isActive: true,
    maxPostsPerMonth: 10,
    postExpiryDays: 30,
    featuredPosts: 1,
    featureConfig: {
      'job.post.max_open_jobs': 10,
      'job.apply.daily_limit': 200,
      'chat.enabled': true,
      'ekyc.required_for_sensitive_jobs': true,
      'job.post.unlimited': false,
      'ai.candidate_match.enabled': false,
      'organization.member_management.enabled': false,
      'worker.service.active_limit': 1,
    },
  },
  {
    code: PlanCode.BUSINESS,
    name: 'Employee Unlimited',
    scope: PlanScope.ORGANIZATION,
    price: 299000,
    isActive: true,
    maxPostsPerMonth: 999999,
    postExpiryDays: 60,
    featuredPosts: 10,
    featureConfig: {
      'job.post.max_open_jobs': 999999,
      'job.apply.daily_limit': 9999,
      'chat.enabled': true,
      'ekyc.required_for_sensitive_jobs': true,
      'job.post.unlimited': true,
      'ai.candidate_match.enabled': true,
      'organization.member_management.enabled': true,
      'worker.service.active_limit': 9999,
    },
  },
  {
    code: PlanCode.STARTER,
    name: 'Starter (legacy)',
    scope: PlanScope.EMPLOYER,
    price: 79000,
    isActive: false,
    maxPostsPerMonth: 15,
    postExpiryDays: 30,
    featuredPosts: 1,
    featureConfig: {},
  },
  {
    code: PlanCode.GROWTH,
    name: 'Growth (legacy)',
    scope: PlanScope.EMPLOYER,
    price: 199000,
    isActive: false,
    maxPostsPerMonth: 60,
    postExpiryDays: 45,
    featuredPosts: 3,
    featureConfig: {},
  },
];

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);
  private payosClient: PayOS | null = null;

  constructor(
    @Inject(payosConfig.KEY)
    private readonly payosConf: ConfigType<typeof payosConfig>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSubscription)
    private readonly userSubscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(UsageCounter)
    private readonly usageCounterRepository: Repository<UsageCounter>,
    @InjectRepository(PaymentOrder)
    private readonly paymentOrderRepository: Repository<PaymentOrder>,
    @Inject(forwardRef(() => EscrowService))
    private readonly escrowService: EscrowService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.ensureSeededPlans();
    this.logger.log('Subscription plans seeded successfully');
  }

  private getPayOSClient(): PayOS {
    if (!this.payosClient) {
      if (
        !this.payosConf.clientId ||
        !this.payosConf.apiKey ||
        !this.payosConf.checksumKey
      ) {
        throw new BadRequestException(SUBSCRIPTION_ERRORS.PAYMENT_CONFIG_ERROR);
      }
      this.payosClient = new PayOS({
        clientId: this.payosConf.clientId,
        apiKey: this.payosConf.apiKey,
        checksumKey: this.payosConf.checksumKey,
      });
    }
    return this.payosClient;
  }

  async ensureSeededPlans(): Promise<void> {
    for (const seed of PLAN_SEEDS) {
      const existed = await this.planRepository.findOne({
        where: { code: seed.code },
      });

      if (!existed) {
        await this.planRepository.save(this.planRepository.create(seed));
        continue;
      }

      await this.planRepository.save(
        this.planRepository.create({
          ...existed,
          ...seed,
        }),
      );
    }
  }

  async getPublicPlans(scope?: PlanScope) {
    const whereClause: Record<string, unknown> = { isActive: true };
    if (scope && Object.values(PlanScope).includes(scope)) {
      whereClause.scope = scope;
    }

    const plans = await this.planRepository.find({
      where: whereClause,
      order: { price: 'ASC' },
    });

    // Only return plans with a valid code (excludes legacy seed data without codes)
    return plans
      .filter((plan) => plan.code)
      .map((plan) => ({
        code: plan.code,
        name: plan.name,
        scope: plan.scope,
        price: Number(plan.price),
        maxPostsPerMonth: plan.maxPostsPerMonth,
        postExpiryDays: plan.postExpiryDays,
        featuredPosts: plan.featuredPosts,
        featureConfig: plan.featureConfig || {},
      }));
  }

  async getEntitlementsForUser(user: User) {
    const roleToScope = this.getScopeByRole(user.role);
    const targetUserId =
      user.role === Role.RECRUITER ? user.organizationId : user.id;
    const currentPlan = await this.getCurrentPlanForUser(
      targetUserId,
      roleToScope,
    );
    const monthlyPostLimit = currentPlan?.maxPostsPerMonth ?? 0;
    const isUnlimitedMonthlyPosts = Boolean(
      currentPlan?.featureConfig?.['job.post.unlimited'],
    );
    const monthlyPostPeriodKey = this.buildPeriodKey('monthly');
    const monthlyPostCounter = await this.usageCounterRepository.findOne({
      where: {
        userId: targetUserId,
        featureKey: 'job.post.count',
        periodKey: monthlyPostPeriodKey,
      },
    });
    const monthlyPostUsed = monthlyPostCounter?.count ?? 0;

    const featureConfig = {
      ...(currentPlan?.featureConfig || {}),
      'job.post.monthly_limit': monthlyPostLimit,
      'job.post.monthly_used': monthlyPostUsed,
      'job.post.monthly_remaining': isUnlimitedMonthlyPosts
        ? null
        : Math.max(monthlyPostLimit - monthlyPostUsed, 0),
      'verification.level': user.verificationLevel,
      'account.role': user.role,
    };

    const isEkycVerified =
      user.verificationLevel === VerificationLevel.BASIC ||
      user.verificationLevel === VerificationLevel.BUSINESS;

    return {
      plan: currentPlan
        ? {
            code: currentPlan.code,
            name: currentPlan.name,
            scope: currentPlan.scope,
            price: Number(currentPlan.price),
          }
        : null,
      verification: {
        level: user.verificationLevel,
        isEkycVerified,
      },
      features: featureConfig,
    };
  }

  async consumeQuota(user: User, quota: ConsumeQuotaConfig): Promise<void> {
    const entitlements = await this.getEntitlementsForUser(user);

    // Cho phép user chưa eKYC đăng bài, bài sẽ không được ưu tiên hiển thị
    // (logic ưu tiên nằm ở sortByTrustPriority trong job.service.ts)

    if (
      quota.counterKey === 'job.post.count' &&
      Boolean(entitlements.features?.['job.post.unlimited'])
    ) {
      return;
    }

    const featureValue = entitlements.features?.[quota.limitFeatureKey];
    const limit = Number(featureValue ?? 0);

    if (!Number.isFinite(limit) || limit <= 0) {
      throw new ForbiddenException(SUBSCRIPTION_ERRORS.FEATURE_NOT_AVAILABLE);
    }

    const periodType = quota.period || 'monthly';
    const amount = quota.amount || 1;
    const periodKey = this.buildPeriodKey(periodType);

    const targetUserId =
      user.role === Role.RECRUITER ? user.organizationId : user.id;

    let counter = await this.usageCounterRepository.findOne({
      where: {
        userId: targetUserId,
        featureKey: quota.counterKey,
        periodKey,
      },
    });

    if (!counter) {
      counter = this.usageCounterRepository.create({
        userId: targetUserId,
        featureKey: quota.counterKey,
        periodKey,
        count: 0,
      });
    }

    const nextCount = counter.count + amount;
    if (nextCount > limit) {
      throw new ForbiddenException(SUBSCRIPTION_ERRORS.QUOTA_EXCEEDED);
    }

    counter.count = nextCount;
    await this.usageCounterRepository.save(counter);
  }

  async assignPlan(adminId: string, targetUserId: string, dto: AssignPlanDto) {

    const plan = await this.planRepository.findOne({
      where: { code: dto.planCode, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException(SUBSCRIPTION_ERRORS.PLAN_NOT_FOUND);
    }

    const newSubscription = await this.activatePlanForUser(targetUserId, plan);

    return {
      assignedBy: adminId,
      userId: targetUserId,
      planCode: plan.code,
      startsAt: newSubscription.startDate,
      endsAt: newSubscription.endDate,
      note: dto.note || null,
    };
  }

  async getUsageSnapshot(user: User) {
    const targetUserId =
      user.role === Role.RECRUITER ? user.organizationId : user.id;
    const counters = await this.usageCounterRepository.find({
      where: { userId: targetUserId },
      order: { updatedAt: 'DESC' },
      take: 100,
    });

    return counters.map((counter) => ({
      featureKey: counter.featureKey,
      periodKey: counter.periodKey,
      count: counter.count,
    }));
  }

  async createCheckout(userId: string, planCode: PlanCode) {

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(USER_ERRORS.USER_NOT_FOUND);
    }

    const plan = await this.planRepository.findOne({
      where: { code: planCode, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException(SUBSCRIPTION_ERRORS.PLAN_NOT_FOUND);
    }

    const expectedScope = this.getScopeByRole(user.role);
    if (plan.scope !== expectedScope) {
      throw new ForbiddenException(SUBSCRIPTION_ERRORS.PLAN_NOT_AVAILABLE);
    }

    if (
      user.role === Role.ORGANIZATION &&
      plan.code === PlanCode.BUSINESS &&
      this.isInOrganizationTrialWindow(user.createdAt)
    ) {
      const subscription = await this.activatePlanForUser(userId, plan);
      return {
        checkoutUrl: null,
        paymentLinkId: null,
        isTrialUpgrade: true,
        startsAt: subscription.startDate,
        endsAt: subscription.endDate,
      };
    }

    if (Number(plan.price) <= 0) {
      throw new BadRequestException(SUBSCRIPTION_ERRORS.PAYMENT_FAILED);
    }

    const orderCode = Number(
      String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000),
    );

    const paymentOrder = this.paymentOrderRepository.create({
      userId,
      planCode,
      orderCode,
      amount: Number(plan.price),
      description: `Upgrade to ${plan.name}`,
    });

    await this.paymentOrderRepository.save(paymentOrder);

    const payos = this.getPayOSClient();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
      const paymentLinkRes = await payos.paymentRequests.create({
        orderCode,
        amount: Number(plan.price),
        description: `Upgrade ${plan.name}`.substring(0, 25),
        returnUrl: `${frontendUrl}/pricing/result`,
        cancelUrl: `${frontendUrl}/pricing/result`,
      });

      paymentOrder.paymentLinkId = paymentLinkRes.paymentLinkId;
      paymentOrder.checkoutUrl = paymentLinkRes.checkoutUrl;
      await this.paymentOrderRepository.save(paymentOrder);

      return {
        checkoutUrl: paymentLinkRes.checkoutUrl,
        paymentLinkId: paymentLinkRes.paymentLinkId,
      };
    } catch (error) {
      this.logger.error('Failed to create PayOS payment link', error);
      paymentOrder.status = PaymentOrderStatus.CANCELLED;
      await this.paymentOrderRepository.save(paymentOrder);
      throw new BadRequestException(SUBSCRIPTION_ERRORS.PAYMENT_FAILED);
    }
  }

  async handleWebhook(body: any) {
    const payos = this.getPayOSClient();
    try {
      const webhookData = await payos.webhooks.verify(body);

      this.logger.log(
        `Received verified webhook for order: ${webhookData.orderCode}`,
      );

      if (body.code !== '00') {
        return { success: true, message: 'Ignoring non-success raw code' };
      }

      const paymentOrder = await this.paymentOrderRepository.findOne({
        where: { orderCode: webhookData.orderCode },
      });

      if (!paymentOrder) {
        // Nếu không phải subscription payment, thử xem có phải escrow deposit không
        const isEscrow = await this.escrowService.handleEscrowDeposit(
          webhookData.orderCode,
          webhookData.amount,
        );
        if (isEscrow) {
          return { success: true, message: 'Processed as escrow deposit' };
        }

        this.logger.warn(
          `Payment order/Escrow not found for orderCode: ${webhookData.orderCode}`,
        );
        return { success: true };
      }

      if (paymentOrder.status === PaymentOrderStatus.PAID) {
        return { success: true, message: 'Already processed' };
      }

      if (webhookData.amount < paymentOrder.amount) {
        this.logger.warn(
          `Underpayment detected for order ${paymentOrder.orderCode}. Expected: ${paymentOrder.amount}, Received: ${webhookData.amount}`,
        );

        await this.notificationService.create({
          userId: paymentOrder.userId,
          type: 'SYSTEM' as any,
          data: {
            title: 'Giao dịch không hợp lệ',
            message: `Hệ thống ghi nhận bạn đã thanh toán ${webhookData.amount}đ cho gói dịch vụ, tuy nhiên số tiền này chưa đủ (Yêu cầu: ${paymentOrder.amount}đ). Vui lòng liên hệ bộ phận hỗ trợ để được nâng cấp thủ công hoặc hoàn tiền. Mã giao dịch: ${paymentOrder.orderCode}.`,
          },
        });

        return { success: true, message: 'Underpaid transaction ignored' };
      }

      paymentOrder.status = PaymentOrderStatus.PAID;
      paymentOrder.paidAt = new Date();
      paymentOrder.webhookData = body;
      await this.paymentOrderRepository.save(paymentOrder);

      await this.upgradePlanForPaymentOrder(paymentOrder);

      return { success: true };
    } catch (error) {
      this.logger.error('Webhook verification failed', error);
      throw new BadRequestException(SUBSCRIPTION_ERRORS.WEBHOOK_INVALID);
    }
  }

  async syncOrderCodeStatus(orderCode: number) {
    const paymentOrder = await this.paymentOrderRepository.findOne({
      where: { orderCode },
    });

    if (!paymentOrder) {
      throw new NotFoundException(RESOURCE_ERRORS.RESOURCE_NOT_FOUND);
    }

    if (paymentOrder.status === PaymentOrderStatus.PAID) {
      return { status: 'PAID' };
    }

    const payos = this.getPayOSClient();
    try {
      const paymentLink = await payos.paymentRequests.get(orderCode);

      if (paymentLink.status === 'PAID' || paymentLink.amountRemaining === 0) {
        paymentOrder.status = PaymentOrderStatus.PAID;
        paymentOrder.paidAt = new Date();
        await this.paymentOrderRepository.save(paymentOrder);

        await this.upgradePlanForPaymentOrder(paymentOrder);
        return { status: 'PAID' };
      }

      return { status: paymentLink.status };
    } catch (error) {
      this.logger.error(`Failed to sync PayOS order ${orderCode}`, error);
      throw new BadRequestException(SUBSCRIPTION_ERRORS.PAYMENT_SYNC_FAILED);
    }
  }

  private async upgradePlanForPaymentOrder(paymentOrder: PaymentOrder) {
    const plan = await this.planRepository.findOne({
      where: { code: paymentOrder.planCode },
    });

    if (plan) {
      await this.activatePlanForUser(paymentOrder.userId, plan);
      this.logger.log(`Upgraded user ${paymentOrder.userId} to ${plan.code}`);
    }
  }

  private async getCurrentPlanForUser(userId: string, scope: PlanScope) {
    const now = new Date();
    const activeSubscription = await this.userSubscriptionRepository.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    if (
      activeSubscription &&
      activeSubscription.endDate > now &&
      activeSubscription.plan.scope === scope
    ) {
      if (activeSubscription.plan.code) {
        const codedPlan = await this.planRepository.findOne({
          where: { code: activeSubscription.plan.code },
        });
        if (codedPlan) {
          return codedPlan;
        }
      }

      const mappedCode = this.mapLegacyPlanCode(activeSubscription.plan, scope);
      if (mappedCode) {
        const mappedPlan = await this.planRepository.findOne({
          where: { code: mappedCode },
        });
        if (mappedPlan) {
          return mappedPlan;
        }
      }
    }

    const fallbackCode =
      scope === PlanScope.ORGANIZATION ? PlanCode.BUSINESS_LITE : PlanCode.FREE;

    return this.planRepository.findOne({ where: { code: fallbackCode } });
  }

  private mapLegacyPlanCode(
    plan: SubscriptionPlan,
    scope: PlanScope,
  ): PlanCode | null {
    const normalizedName = (plan.name || '').trim().toLowerCase();
    const price = Number(plan.price || 0);

    if (scope === PlanScope.ORGANIZATION) {
      return price > 0 ? PlanCode.BUSINESS : PlanCode.BUSINESS_LITE;
    }

    if (
      normalizedName.includes('free') ||
      normalizedName.includes('miễn phí') ||
      normalizedName.includes('mien phi')
    ) {
      return PlanCode.FREE;
    }

    if (
      normalizedName.includes('pro') ||
      normalizedName.includes('starter') ||
      normalizedName.includes('growth') ||
      normalizedName.includes('cơ bản') ||
      normalizedName.includes('co ban') ||
      normalizedName.includes('chuyên nghiệp') ||
      normalizedName.includes('chuyen nghiep')
    ) {
      return PlanCode.PRO;
    }

    return price > 0 ? PlanCode.PRO : PlanCode.FREE;
  }

  private getScopeByRole(role: Role): PlanScope {
    if (role === Role.ORGANIZATION || role === Role.RECRUITER) {
      return PlanScope.ORGANIZATION;
    }

    if (role === Role.USER) {
      return PlanScope.EMPLOYER;
    }

    return PlanScope.EMPLOYER;
  }

  private isInOrganizationTrialWindow(createdAt: Date): boolean {
    const trialEnd = new Date(createdAt);
    trialEnd.setMonth(trialEnd.getMonth() + 3);
    return new Date() < trialEnd;
  }

  private async activatePlanForUser(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<UserSubscription> {
    await this.userSubscriptionRepository.update(
      { userId, status: SubscriptionStatus.ACTIVE },
      { status: SubscriptionStatus.CANCELLED },
    );

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const newSubscription = this.userSubscriptionRepository.create({
      userId,
      planId: plan.id,
      startDate,
      endDate,
      status: SubscriptionStatus.ACTIVE,
    });

    return this.userSubscriptionRepository.save(newSubscription);
  }

  private buildPeriodKey(period: 'daily' | 'monthly'): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');

    if (period === 'monthly') {
      return `${year}-${month}`;
    }

    const day = `${now.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
