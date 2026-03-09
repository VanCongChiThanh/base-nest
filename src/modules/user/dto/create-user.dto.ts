import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'Password phải có ít nhất 6 ký tự' })
  password?: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ không được để trống' })
  lastName: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
