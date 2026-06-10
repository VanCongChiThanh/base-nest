import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { JobCategoryType } from '../entities/job-category.entity';

export class CreateJobCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsEnum(JobCategoryType)
  type?: JobCategoryType;
}
