import { IsString, IsNotEmpty, IsArray, IsDateString, IsOptional, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { ServiceType } from '../entities/worker-service.entity';

export class CreateWorkerServiceDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsOptional()
  skillIds?: string[];

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsString()
  @IsOptional()
  recurring?: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  priceType?: 'HOURLY' | 'FIXED';

  @IsBoolean()
  @IsOptional()
  isNegotiable?: boolean;

  @IsString()
  @IsOptional()
  provinceCode?: string;

  @IsString()
  @IsOptional()
  wardCode?: string;

  @IsNumber()
  @IsOptional()
  radiusKm?: number;

  @IsEnum(ServiceType)
  @IsOptional()
  type?: ServiceType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  portfolioUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isAvailableNow?: boolean;
}
