import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { PresignedUrlDto, PresignedUrlResponseDto } from './dto';
import { UPLOAD_ERRORS, SYSTEM_ERRORS, BadRequestException, InternalServerErrorException } from '../../common';
import cloudinaryConfig from '../../config/cloudinary.config';

@Injectable()
export class UploadService {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  // list of allowed mime types
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  // max file size 10MB
  private readonly maxFileSize = 10 * 1024 * 1024;

  constructor(
    @Inject(cloudinaryConfig.KEY)
    private readonly cloudinaryConf: ConfigType<typeof cloudinaryConfig>,
  ) {
    this.cloudName = this.cloudinaryConf.cloudName || '';
    this.apiKey = this.cloudinaryConf.apiKey || '';
    this.apiSecret = this.cloudinaryConf.apiSecret || '';

    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      console.warn('Cloudinary configuration is missing. Upload feature might fail.');
    }

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
  }

  /**
   * Create presigned URL (signature) for Cloudinary upload
   */
  async generatePresignedUrl(
    presignedUrlDto: PresignedUrlDto,
    userId: string,
  ): Promise<PresignedUrlResponseDto> {
    const { fileName, fileType, fileSize } = presignedUrlDto;

    // Validate file type
    if (!this.allowedMimeTypes.includes(fileType)) {
      throw new BadRequestException(UPLOAD_ERRORS.UPLOAD_INVALID_FILE_TYPE);
    }

    // Validate file size
    if (fileSize > this.maxFileSize) {
      throw new BadRequestException(UPLOAD_ERRORS.UPLOAD_FILE_TOO_LARGE);
    }

    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = `uploads/${userId}`;

      // Generate signature
      const signature = cloudinary.utils.api_sign_request(
        {
          timestamp: timestamp,
          folder: folder,
        },
        this.apiSecret,
      );

      // Cloudinary upload API URL
      const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;

      return new PresignedUrlResponseDto({
        uploadUrl,
        signature,
        timestamp,
        apiKey: this.apiKey,
        folder,
      });
    } catch (error) {
      throw new InternalServerErrorException(SYSTEM_ERRORS.SYSTEM_UPLOAD_SIGNATURE_FAILED);
    }
  }
}
