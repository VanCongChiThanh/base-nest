import { IsEnum, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrivacyVisibility } from '../../../common/enums';

export class WorkerPrivacySettingsDto {
  @IsOptional()
  @IsEnum(PrivacyVisibility)
  phone?: PrivacyVisibility;

  @IsOptional()
  @IsEnum(PrivacyVisibility)
  address?: PrivacyVisibility;

  @IsOptional()
  @IsEnum(PrivacyVisibility)
  dateOfBirth?: PrivacyVisibility;

  @IsOptional()
  @IsEnum(PrivacyVisibility)
  location?: PrivacyVisibility;
}

export class EmployerPrivacySettingsDto {
  @IsOptional()
  @IsEnum(PrivacyVisibility)
  phone?: PrivacyVisibility;

  @IsOptional()
  @IsEnum(PrivacyVisibility)
  address?: PrivacyVisibility;

  @IsOptional()
  @IsEnum(PrivacyVisibility)
  companyDescription?: PrivacyVisibility;
}

export class UpdateWorkerPrivacyDto {
  @IsObject()
  @ValidateNested()
  @Type(() => WorkerPrivacySettingsDto)
  privacySettings: WorkerPrivacySettingsDto;
}

export class UpdateEmployerPrivacyDto {
  @IsObject()
  @ValidateNested()
  @Type(() => EmployerPrivacySettingsDto)
  privacySettings: EmployerPrivacySettingsDto;
}
