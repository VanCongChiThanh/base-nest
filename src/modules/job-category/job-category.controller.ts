import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JobCategoryService } from './job-category.service';
import { CreateJobCategoryDto } from './dto';
import { Roles, Public } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { Role } from '../../common/enums';

@Controller('job-categories')
export class JobCategoryController {
  constructor(private readonly jobCategoryService: JobCategoryService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateJobCategoryDto) {
    return this.jobCategoryService.create(dto);
  }

  @Get()
  @Public()
  async findAll() {
    return this.jobCategoryService.findAll();
  }

  @Get(':id')
  @Public()
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobCategoryService.findById(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.jobCategoryService.delete(id);
    return { message: 'Job category deleted successfully' };
  }
}
