import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PresignedUrlDto, PresignedUrlResponseDto } from './dto';
import { UPLOAD_ERRORS, BadRequestException } from '../../common';

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

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

  constructor(private readonly configService: ConfigService) {
    this.region =
      this.configService.get<string>('aws.region') || 'ap-southeast-1';
    this.bucketName = this.configService.get<string>('aws.s3Bucket') || '';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') || '',
        secretAccessKey:
          this.configService.get<string>('aws.secretAccessKey') || '',
      },
    });
  }

  /**
   * Create presigned URL for file upload
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

    // Create unique file key
    const fileExtension = this.getFileExtension(fileName);
    const key = `uploads/${userId}/${uuidv4()}${fileExtension}`;

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
    });

    const expiresIn = 3600; // 1 hour
    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    // Public file URL
    const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

    return new PresignedUrlResponseDto({
      uploadUrl,
      fileUrl,
      key,
      expiresIn,
    });
  }

  /**
   * Get file extension from file name
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }
}
