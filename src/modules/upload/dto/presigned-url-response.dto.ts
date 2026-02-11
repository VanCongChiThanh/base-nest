/**
 * DTO for presigned URL response
 */
export class PresignedUrlResponseDto {
  /**
   * URL for uploading the file to S3
   */
  uploadUrl: string;

  /**
   * Public URL for accessing the file after upload
   */
  fileUrl: string;

  /**
   * Key of the file in S3
   */
  key: string;

  /**
   * expiration time in seconds
   */
  expiresIn: number;

  constructor(partial: Partial<PresignedUrlResponseDto>) {
    Object.assign(this, partial);
  }
}
