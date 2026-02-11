import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * DTO for forgot password request
 */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;
}
