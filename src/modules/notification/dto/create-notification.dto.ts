import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificationType, ReferenceType } from '../../../common/enums';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(ReferenceType)
  @IsOptional()
  refType?: ReferenceType;

  @IsString()
  @IsOptional()
  refId?: string;

  /** Data for FE render message (e.g., { orderCode: 'ORD-001', userName: 'John' }) */
  @IsOptional()
  data?: Record<string, unknown>;
}
