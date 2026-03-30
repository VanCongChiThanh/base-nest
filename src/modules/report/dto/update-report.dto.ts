import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ReportStatus } from '../../../common/enums';

export class UpdateReportDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
