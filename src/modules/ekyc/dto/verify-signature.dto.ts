import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class VerifySignatureDto {
  @IsString()
  @IsNotEmpty()
  dataBase64: string;

  @IsString()
  @IsNotEmpty()
  dataSign: string;

  @IsString()
  @IsOptional()
  publicKey?: string;

  @IsOptional()
  @IsObject()
  responseData?: Record<string, unknown>;
}
