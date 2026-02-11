import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

/**
 * DTO for presigned URL request
 */
export class PresignedUrlDto {
  @IsString()
  @IsNotEmpty({ message: 'File name must not be empty' })
  fileName: string;

  @IsString()
  @IsNotEmpty({ message: 'File type must not be empty' })
  fileType: string;

  @IsNumber()
  @Min(1, { message: 'File size must be greater than 0' })
  @Max(10 * 1024 * 1024, {
    message: 'File size must not exceed 10MB',
  })
  fileSize: number;
}
