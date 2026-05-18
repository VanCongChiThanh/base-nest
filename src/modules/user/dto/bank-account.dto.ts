import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsUrl } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  accountName: string;

  @IsOptional()
  @IsUrl()
  qrCodeUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsUrl()
  qrCodeUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
