import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, Public } from '../../common/decorators';
import { User } from '../user/entities';
import { CompleteEkycDto, VerifySignatureDto } from './dto';
import { EkycService } from './ekyc.service';

@Controller('ekyc')
export class EkycController {
  constructor(private readonly ekycService: EkycService) {}

  @Public()
  @Get('sdk-config')
  getSdkConfig() {
    return this.ekycService.getSdkConfig();
  }

  @Public()
  @Post('access-token')
  async getAccessToken() {
    return this.ekycService.getAccessToken();
  }

  @Public()
  @Post('verify-signature')
  verifySignature(@Body() verifySignatureDto: VerifySignatureDto) {
    return this.ekycService.verifySignature(verifySignatureDto);
  }

  @Post('complete')
  completeVerification(
    @CurrentUser() user: User,
    @Body() completeEkycDto: CompleteEkycDto,
  ) {
    return this.ekycService.completeVerification(user.id, completeEkycDto);
  }
}
