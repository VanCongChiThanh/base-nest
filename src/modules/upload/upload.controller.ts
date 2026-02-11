import { Controller, Post, Body } from '@nestjs/common';
import { UploadService } from './upload.service';
import { PresignedUrlDto, PresignedUrlResponseDto } from './dto';
import { CurrentUser } from '../../common/decorators';
import { User } from '../user/entities';

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  async getPresignedUrl(
    @Body() presignedUrlDto: PresignedUrlDto,
    @CurrentUser() user: User,
  ): Promise<PresignedUrlResponseDto> {
    return this.uploadService.generatePresignedUrl(presignedUrlDto, user.id);
  }
}
