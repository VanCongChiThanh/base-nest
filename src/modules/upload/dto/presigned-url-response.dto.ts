/**
 * DTO for Cloudinary upload signature response
 */
export class PresignedUrlResponseDto {
  /**
   * Cloudinary endpoint for POST request
   */
  uploadUrl: string;

  /**
   * Cloudinary generated signature
   */
  signature: string;

  /**
   * Timestamp used to generate signature
   */
  timestamp: number;

  /**
   * Cloudinary API Key
   */
  apiKey: string;

  /**
   * Cloudinary Folder
   */
  folder: string;

  constructor(partial: Partial<PresignedUrlResponseDto>) {
    Object.assign(this, partial);
  }
}
