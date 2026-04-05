import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PlanCode } from '../../../common/enums';

export class AssignPlanDto {
  @IsEnum(PlanCode)
  planCode: PlanCode;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  note?: string;
}
