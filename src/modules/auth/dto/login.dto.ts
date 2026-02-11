import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for login request
 */
export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password không được để trống' })
  password: string;
}
