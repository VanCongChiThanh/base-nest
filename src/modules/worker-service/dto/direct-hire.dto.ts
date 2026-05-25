import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { JobType, OnlinePaymentType } from '../../../common/enums';

export class DirectHireDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsEnum(JobType)
  jobType: JobType;

  @IsOptional()
  @IsNumber()
  salaryPerHour?: number;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  provinceCode?: number;

  @IsOptional()
  @IsNumber()
  wardCode?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  totalBudget?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(OnlinePaymentType)
  onlinePaymentType?: OnlinePaymentType;
}
