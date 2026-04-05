import { Exclude, Expose } from 'class-transformer';
import { Role, VerificationLevel } from '../../../common/enums';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  role: Role;

  @Expose()
  isEmailVerified: boolean;

  @Expose()
  avatarUrl: string;

  @Expose()
  verificationLevel: VerificationLevel;

  @Expose()
  createdAt: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
