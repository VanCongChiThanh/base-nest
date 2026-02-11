import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO for reset password request
 */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Token không được để trống' })
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'Password mới không được để trống' })
  @MinLength(6, { message: 'Password phải có ít nhất 6 ký tự' })
  newPassword: string;
}
