import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AiChatDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
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
