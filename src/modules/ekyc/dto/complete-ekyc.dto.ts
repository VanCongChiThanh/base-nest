import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CompleteEkycDto {
  @IsString()
  @IsNotEmpty()
  dataBase64: string;

  @IsString()
  @IsNotEmpty()
  dataSign: string;

  @IsOptional()
  @IsObject()
  responseData?: Record<string, unknown>;
}
