import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from './entities';
import { CreateSkillDto, UpdateSkillDto } from './dto';import {
  SKILL_ERRORS,
  NotFoundException,
  ConflictException,
} from '../../common';

@Injectable()
export class SkillService {
  constructor(
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
  ) {}

  async create(dto: CreateSkillDto): Promise<Skill> {
    const existing = await this.skillRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(SKILL_ERRORS.SKILL_ALREADY_EXISTS);
    }
    const skill = this.skillRepository.create(dto);
    return this.skillRepository.save(skill);
  }

  async findAll(): Promise<Skill[]> {
    return this.skillRepository.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Skill> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) {
      throw new NotFoundException(SKILL_ERRORS.SKILL_NOT_FOUND);
    }
    return skill;
  }

  async update(id: string, dto: UpdateSkillDto): Promise<Skill> {
    const skill = await this.findById(id);
    if (dto.name && dto.name !== skill.name) {
      const existing = await this.skillRepository.findOne({
        where: { name: dto.name },
      });
      // check if skill already exists
      if (existing) {
        throw new ConflictException(SKILL_ERRORS.SKILL_ALREADY_EXISTS);
      }
    }
    Object.assign(skill, dto);
    return this.skillRepository.save(skill);
  }

  async delete(id: string): Promise<void> {
    const skill = await this.findById(id);
    await this.skillRepository.remove(skill);
  }
}
