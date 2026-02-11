import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO for register request
 */
export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password không được để trống' })
  @MinLength(6, { message: 'Password phải có ít nhất 6 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ không được để trống' })
  lastName: string;
}
