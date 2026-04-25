import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JobSalaryType, JobType } from '../../../common/enums';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salaryPerHour: number;

  @IsOptional()
  @IsString()
  salaryType?: JobSalaryType;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  requiredWorkers: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsNumber()
  @Type(() => Number)
  provinceCode: number;

  @IsNumber()
  @Type(() => Number)
  wardCode: number;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillIds?: string[];

  // === Job Type ===
  @IsOptional()
  @IsString()
  jobType?: JobType;

  // === Part-time fields ===
  @IsOptional()
  @IsString()
  contractDuration?: string;

  @IsOptional()
  @IsString()
  workSchedule?: string;

  @IsOptional()
  @IsString()
  paymentNote?: string;

  // === Online fields ===
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalBudget?: number;

  @IsOptional()
  @IsString()
  deliverableType?: string;
}
