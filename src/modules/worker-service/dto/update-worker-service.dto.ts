import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkerServiceDto } from './create-worker-service.dto';

export class UpdateWorkerServiceDto extends PartialType(
  CreateWorkerServiceDto,
) {}
