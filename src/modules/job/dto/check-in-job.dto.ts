import { IsOptional, IsString } from 'class-validator';

export class CheckInJobDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
