import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkerProfile, EmployerProfile, WorkerSkill } from './entities';
import {
  CreateWorkerProfileDto,
  UpdateWorkerProfileDto,
  CreateEmployerProfileDto,
  UpdateEmployerProfileDto,
  UpdateWorkerPrivacyDto,
  UpdateEmployerPrivacyDto,
} from './dto';
import {
  PROFILE_ERRORS,
  NotFoundException,
  ConflictException,
} from '../../common';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(WorkerProfile)
    private readonly workerRepo: Repository<WorkerProfile>,
    @InjectRepository(EmployerProfile)
    private readonly employerRepo: Repository<EmployerProfile>,
    @InjectRepository(WorkerSkill)
    private readonly workerSkillRepo: Repository<WorkerSkill>,
  ) {}

  // ==================== WORKER PROFILE ====================

  async createWorkerProfile(
    userId: string,
    dto: CreateWorkerProfileDto,
  ): Promise<WorkerProfile> {
    const existing = await this.workerRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException(PROFILE_ERRORS.PROFILE_ALREADY_EXISTS);
    }

    const { skillIds, ...profileData } = dto;
    const profile = this.workerRepo.create({ ...profileData, userId });
    const saved = await this.workerRepo.save(profile);

    if (skillIds?.length) {
      await this.syncWorkerSkills(saved.id, skillIds);
    }

    return this.getWorkerProfile(userId);
  }

  async updateWorkerProfile(
    userId: string,
    dto: UpdateWorkerProfileDto,
  ): Promise<WorkerProfile> {
    const profile = await this.workerRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(PROFILE_ERRORS.WORKER_PROFILE_NOT_FOUND);
    }

    const { skillIds, ...profileData } = dto;
    Object.assign(profile, profileData);
    await this.workerRepo.save(profile);

    if (skillIds !== undefined) {
      await this.syncWorkerSkills(profile.id, skillIds);
    }

    return this.getWorkerProfile(userId);
  }

  async getWorkerProfile(userId: string): Promise<WorkerProfile> {
    const profile = await this.workerRepo.findOne({
      where: { userId },
      relations: ['user', 'workerSkills', 'workerSkills.skill'],
    });
    if (!profile) {
      throw new NotFoundException(PROFILE_ERRORS.WORKER_PROFILE_NOT_FOUND);
    }
    return profile;
  }

  async getWorkerProfileById(id: string): Promise<WorkerProfile> {
    const profile = await this.workerRepo.findOne({
      where: { id },
      relations: ['user', 'workerSkills', 'workerSkills.skill'],
    });
    if (!profile) {
      throw new NotFoundException(PROFILE_ERRORS.WORKER_PROFILE_NOT_FOUND);
    }
    return profile;
  }

  // ==================== PRIVACY SETTINGS ====================

  async updateWorkerPrivacySettings(
    userId: string,
    dto: UpdateWorkerPrivacyDto,
  ): Promise<WorkerProfile> {
    const profile = await this.workerRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(PROFILE_ERRORS.WORKER_PROFILE_NOT_FOUND);
    }
    profile.privacySettings = {
      ...(profile.privacySettings ?? {}),
      ...dto.privacySettings,
    };
    return this.workerRepo.save(profile);
  }

  async updateEmployerPrivacySettings(
    userId: string,
    dto: UpdateEmployerPrivacyDto,
  ): Promise<EmployerProfile> {
    const profile = await this.employerRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(PROFILE_ERRORS.EMPLOYER_PROFILE_NOT_FOUND);
    }
    profile.privacySettings = {
      ...(profile.privacySettings ?? {}),
      ...dto.privacySettings,
    };
    return this.employerRepo.save(profile);
  }

  private async syncWorkerSkills(
    workerProfileId: string,
    skillIds: string[],
  ): Promise<void> {
    await this.workerSkillRepo.delete({ workerProfileId });
    if (skillIds.length) {
      const workerSkills = skillIds.map((skillId) =>
        this.workerSkillRepo.create({ workerProfileId, skillId }),
      );
      await this.workerSkillRepo.save(workerSkills);
    }
  }

  // ==================== EMPLOYER PROFILE ====================

  async createEmployerProfile(
    userId: string,
    dto: CreateEmployerProfileDto,
  ): Promise<EmployerProfile> {
    const existing = await this.employerRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException(PROFILE_ERRORS.PROFILE_ALREADY_EXISTS);
    }

    const profile = this.employerRepo.create({ ...dto, userId });
    return this.employerRepo.save(profile);
  }

  async updateEmployerProfile(
    userId: string,
    dto: UpdateEmployerProfileDto,
  ): Promise<EmployerProfile> {
    const profile = await this.employerRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(PROFILE_ERRORS.EMPLOYER_PROFILE_NOT_FOUND);
    }

    Object.assign(profile, dto);
    return this.employerRepo.save(profile);
  }

  async getEmployerProfile(userId: string): Promise<EmployerProfile> {
    const profile = await this.employerRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException(PROFILE_ERRORS.EMPLOYER_PROFILE_NOT_FOUND);
    }
    return profile;
  }

  async getEmployerProfileById(id: string): Promise<EmployerProfile> {
    const profile = await this.employerRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException(PROFILE_ERRORS.EMPLOYER_PROFILE_NOT_FOUND);
    }
    return profile;
  }
}
