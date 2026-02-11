import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for refresh token request
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  refreshToken: string;
}
