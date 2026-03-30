import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { LocationService } from './location.service';
import { Public } from '../../common/decorators';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('provinces')
  @Public()
  async getProvinces() {
    return this.locationService.getProvinces();
  }

  @Get('provinces/:code')
  @Public()
  async getProvinceWithWards(@Param('code', ParseIntPipe) code: number) {
    return this.locationService.getProvinceWithWards(code);
  }

  @Get('wards/:code')
  @Public()
  async getWard(@Param('code', ParseIntPipe) code: number) {
    return this.locationService.getWard(code);
  }
}
