import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { WorkerProfile, EmployerProfile, WorkerSkill } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkerProfile, EmployerProfile, WorkerSkill]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
