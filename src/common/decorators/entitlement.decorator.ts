import { SetMetadata } from '@nestjs/common';

export const REQUIRED_FEATURES_KEY = 'required_features';
export const CONSUME_QUOTAS_KEY = 'consume_quotas';

export interface RequiredFeatureConfig {
  key: string;
  equals?: boolean | number | string;
}

export interface ConsumeQuotaConfig {
  counterKey: string;
  limitFeatureKey: string;
  period?: 'daily' | 'monthly';
  amount?: number;
}

export const RequireFeature = (config: RequiredFeatureConfig) =>
  SetMetadata(REQUIRED_FEATURES_KEY, [config]);

export const ConsumeQuota = (config: ConsumeQuotaConfig) =>
  SetMetadata(CONSUME_QUOTAS_KEY, [config]);
