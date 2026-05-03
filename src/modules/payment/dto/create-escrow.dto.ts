import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMilestoneItemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1000) // Tối thiểu 1.000 VNĐ
  @Type(() => Number)
  amount: number;
}

export class CreateEscrowDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneItemDto)
  milestones: CreateMilestoneItemDto[];
}
