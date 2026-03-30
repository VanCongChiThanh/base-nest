import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobCategory } from './entities';
import { CreateJobCategoryDto } from './dto';
import {
  CATEGORY_ERRORS,
  NotFoundException,
  ConflictException,
} from '../../common';

@Injectable()
export class JobCategoryService {
  constructor(
    @InjectRepository(JobCategory)
    private readonly categoryRepository: Repository<JobCategory>,
  ) {}

  async create(dto: CreateJobCategoryDto): Promise<JobCategory> {
    const existing = await this.categoryRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(CATEGORY_ERRORS.CATEGORY_ALREADY_EXISTS);
    }
    const category = this.categoryRepository.create(dto);
    return this.categoryRepository.save(category);
  }

  async findAll(): Promise<JobCategory[]> {
    return this.categoryRepository.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<JobCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(CATEGORY_ERRORS.CATEGORY_NOT_FOUND);
    }
    return category;
  }

  async delete(id: string): Promise<void> {
    const category = await this.findById(id);
    await this.categoryRepository.remove(category);
  }
}
