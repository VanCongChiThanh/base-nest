import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  IsUUID,
  Min,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  JobSalaryType,
  JobType,
  OnlinePaymentType,
  ExperienceLevel,
} from '../../../common/enums';

export class CreateJobDto {
  // ── Core (all types) ──────────────────────
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillIds?: string[];

  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  // ── GIG / PART_TIME only ──────────────────
  /** Required for GIG/PART_TIME. Not used for ONLINE. */
  @ValidateIf((o) => o.jobType !== JobType.ONLINE)
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salaryPerHour?: number;

  @IsOptional()
  @IsEnum(JobSalaryType)
  salaryType?: JobSalaryType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  requiredWorkers?: number;

  @ValidateIf((o) => o.jobType !== JobType.ONLINE)
  @IsDateString()
  startTime?: string;

  @ValidateIf((o) => o.jobType !== JobType.ONLINE)
  @IsDateString()
  endTime?: string;

  @ValidateIf((o) => o.jobType !== JobType.ONLINE)
  @IsNumber()
  @Type(() => Number)
  provinceCode?: number;

  @ValidateIf((o) => o.jobType !== JobType.ONLINE)
  @IsNumber()
  @Type(() => Number)
  wardCode?: number;

  @ValidateIf((o) => o.jobType !== JobType.ONLINE)
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  // ── PART_TIME extra ───────────────────────
  @IsOptional()
  @IsString()
  contractDuration?: string;

  @IsOptional()
  @IsString()
  workSchedule?: string;

  @IsOptional()
  @IsString()
  paymentNote?: string;

  // ── ONLINE only (Upwork-style) ────────────
  /**
   * FIXED_PRICE: khoán toàn bộ (cần totalBudget)
   * HOURLY_RATE: theo giờ (cần hourlyRateMin/Max)
   */
  @ValidateIf((o) => o.jobType === JobType.ONLINE)
  @IsEnum(OnlinePaymentType)
  onlinePaymentType?: OnlinePaymentType;

  /** Ngân sách tổng – bắt buộc nếu FIXED_PRICE */
  @ValidateIf(
    (o) =>
      o.jobType === JobType.ONLINE &&
      o.onlinePaymentType === OnlinePaymentType.FIXED_PRICE,
  )
  @IsNumber()
  @Min(1000)
  @Type(() => Number)
  totalBudget?: number;

  /** Rate tối thiểu đ/giờ – dùng khi HOURLY_RATE */
  @ValidateIf(
    (o) =>
      o.jobType === JobType.ONLINE &&
      o.onlinePaymentType === OnlinePaymentType.HOURLY_RATE,
  )
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hourlyRateMin?: number;

  /** Rate tối đa đ/giờ – dùng khi HOURLY_RATE */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hourlyRateMax?: number;

  /** Deadline hoàn thành dự án (ONLINE) */
  @ValidateIf((o) => o.jobType === JobType.ONLINE)
  @IsDateString()
  deadline?: string;

  /** Mức kinh nghiệm yêu cầu */
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  /** Loại sản phẩm giao nộp */
  @IsOptional()
  @IsString()
  deliverableType?: string;

  /** Phạm vi dự án (ngắn gọn) */
  @IsOptional()
  @IsString()
  projectScope?: string;
}
