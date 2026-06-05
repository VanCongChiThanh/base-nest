import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
  IsIn,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ALL_SYNC_TARGETS, SyncTarget } from '../ai-embedding.constants';

export class AiChatDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class BatchSyncDto {
  @IsOptional()
  @IsArray()
  @IsIn(ALL_SYNC_TARGETS, { each: true })
  targets?: SyncTarget[];
}

const FAQ_NODE_TYPES = ['faq', 'guide', 'policy', 'safety', 'general'] as const;

export class UpsertFaqDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIn(FAQ_NODE_TYPES)
  nodeType: string;

  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  @MaxLength(5000)
  content: string;
}

export class AnalyzeJobDto {
  @IsString()
  jobId: string;
}

export class AnalyzeJobContentDto {
  @IsString()
  @MaxLength(5000)
  title: string;

  @IsString()
  @MaxLength(10000)
  description: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  salary?: number;

  @IsOptional()
  @IsString()
  address?: string;
}
