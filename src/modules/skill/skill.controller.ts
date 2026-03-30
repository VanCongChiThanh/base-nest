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
import { SkillService } from './skill.service';
import { CreateSkillDto } from './dto';
import { Roles, Public } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { Role } from '../../common/enums';

@Controller('skills')
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateSkillDto) {
    return this.skillService.create(dto);
  }

  @Get()
  @Public()
  async findAll() {
    return this.skillService.findAll();
  }

  @Get(':id')
  @Public()
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.skillService.findById(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.skillService.delete(id);
    return { message: 'Skill deleted successfully' };
  }
}
