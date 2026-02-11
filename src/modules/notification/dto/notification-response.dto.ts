import { Expose } from 'class-transformer';
import { NotificationType, ReferenceType } from '../../../common/enums';

export class NotificationResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: NotificationType;

  @Expose()
  refType: ReferenceType | null;

  @Expose()
  refId: string | null;

  @Expose()
  data: Record<string, unknown> | null;

  @Expose()
  isRead: boolean;

  @Expose()
  createdAt: Date;
}
