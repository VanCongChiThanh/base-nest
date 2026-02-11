/**
 * DTO for token response
 */
export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;

  constructor(partial: Partial<TokenResponseDto>) {
    Object.assign(this, partial);
  }
}
