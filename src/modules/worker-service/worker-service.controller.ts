import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { WorkerServiceService } from './worker-service.service';
import { CreateWorkerServiceDto, UpdateWorkerServiceDto, WorkerServiceQueryDto } from './dto';
import { CurrentUser, JwtAuthGuard } from '../../common'; // adjust based on actual import paths
import { User } from '../user/entities/user.entity';

@Controller('worker-services')
export class WorkerServiceController {
  constructor(private readonly workerServiceService: WorkerServiceService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: User, @Body() createDto: CreateWorkerServiceDto) {
    return this.workerServiceService.create(user.id, createDto);
  }

  @Get()
  findAll(@Query() query: WorkerServiceQueryDto) {
    return this.workerServiceService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-services')
  findMyServices(@CurrentUser() user: User) {
    return this.workerServiceService.findByWorkerId(user.id);
  }

  @Get('worker/:workerId')
  findByWorkerId(@Param('workerId') workerId: string) {
    return this.workerServiceService.findByWorkerId(workerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workerServiceService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateDto: UpdateWorkerServiceDto,
  ) {
    return this.workerServiceService.update(id, user.id, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.workerServiceService.remove(id, user.id);
  }
}
