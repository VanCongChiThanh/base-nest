import { IsString, IsNotEmpty, IsUUID, IsOptional, IsEnum } from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  @IsNotEmpty()
  targetId: string;

  @IsEnum(['USER', 'JOB'])
  @IsNotEmpty()
  targetType: 'USER' | 'JOB';

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;
}
