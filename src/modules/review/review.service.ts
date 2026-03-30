import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities';
import { CreateReviewDto } from './dto';
import {
  REVIEW_ERRORS,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '../../common';
import { NotificationType, AssignmentStatus } from '../../common/enums';
import { NotificationHelper } from '../notification';
import { JobAssignment } from '../job/entities';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(JobAssignment)
    private readonly assignmentRepository: Repository<JobAssignment>,
    private readonly notificationHelper: NotificationHelper,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto): Promise<Review> {
    // Verify the job is completed and the reviewer is involved
    const assignment = await this.assignmentRepository.findOne({
      where: { jobId: dto.jobId, status: AssignmentStatus.COMPLETED },
      relations: ['job'],
    });

    if (!assignment) {
      throw new BadRequestException(REVIEW_ERRORS.REVIEW_JOB_NOT_COMPLETED);
    }

    // Reviewer must be the worker or the employer of the job
    const isWorker = assignment.workerId === reviewerId;
    const isEmployer = assignment.job.employerId === reviewerId;

    if (!isWorker && !isEmployer) {
      throw new ForbiddenException(REVIEW_ERRORS.REVIEW_NOT_ALLOWED);
    }

    // Check duplicate
    const existing = await this.reviewRepository.findOne({
      where: { reviewerId, jobId: dto.jobId },
    });
    if (existing) {
      throw new ConflictException(REVIEW_ERRORS.REVIEW_ALREADY_EXISTS);
    }

    const review = this.reviewRepository.create({
      ...dto,
      reviewerId,
    });
    const saved = await this.reviewRepository.save(review);

    // Notify reviewee
    await this.notificationHelper.send(
      dto.revieweeId,
      NotificationType.REVIEW_RECEIVED,
      saved.id,
      { rating: dto.rating },
    );

    return saved;
  }

  async findByJob(
    jobId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Review[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.reviewRepository.findAndCount({
      where: { jobId },
      relations: ['reviewer', 'reviewee'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Review[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.reviewRepository.findAndCount({
      where: { revieweeId: userId },
      relations: ['reviewer', 'job'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['reviewer', 'reviewee', 'job'],
    });
    if (!review) {
      throw new NotFoundException(REVIEW_ERRORS.REVIEW_NOT_FOUND);
    }
    return review;
  }
}
