import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  @IsNotEmpty()
  reportedUserId: string;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;
}
