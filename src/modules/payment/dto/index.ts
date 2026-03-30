import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateDisputeDto {
  @IsString()
  reason: string;
}

export class ResolveDisputeDto {
  @IsString()
  resolution: string;
}
