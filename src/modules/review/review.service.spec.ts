import { Test, TestingModule } from '@nestjs/testing';
import { ReviewService } from './review.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Review } from './entities';
import { JobAssignment } from '../job/entities';
import { WorkerProfile, EmployerProfile } from '../profile/entities';
import { NotificationHelper } from '../notification';
import { AssignmentStatus } from '../../common/enums';

describe('ReviewService', () => {
  let service: ReviewService;

  const mockReview = {
    id: 'r1',
    reviewerId: 'u1',
    revieweeId: 'u2',
    jobId: 'j1',
    rating: 5,
    comment: 'Great worker!',
    createdAt: new Date(),
  };

  const mockAssignment = {
    id: 'a1',
    jobId: 'j1',
    workerId: 'u1',
    status: AssignmentStatus.COMPLETED,
    job: { id: 'j1', employerId: 'u2' },
  };

  const mockRatingQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ avg: '5', count: '1' }),
  };

  const mockReviewRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => mockRatingQueryBuilder),
  };

  const mockAssignmentRepo = {
    findOne: jest.fn(),
  };

  const mockWorkerProfileRepo = {
    update: jest.fn(),
  };

  const mockEmployerProfileRepo = {
    update: jest.fn(),
  };

  const mockNotificationHelper = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: getRepositoryToken(Review), useValue: mockReviewRepo },
        {
          provide: getRepositoryToken(JobAssignment),
          useValue: mockAssignmentRepo,
        },
        {
          provide: getRepositoryToken(WorkerProfile),
          useValue: mockWorkerProfileRepo,
        },
        {
          provide: getRepositoryToken(EmployerProfile),
          useValue: mockEmployerProfileRepo,
        },
        { provide: NotificationHelper, useValue: mockNotificationHelper },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a review successfully', async () => {
      mockAssignmentRepo.findOne.mockResolvedValue(mockAssignment);
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockReturnValue(mockReview);
      mockReviewRepo.save.mockResolvedValue(mockReview);

      const result = await service.create('u1', {
        jobId: 'j1',
        revieweeId: 'u2',
        rating: 5,
        comment: 'Great worker!',
      });

      expect(result.rating).toBe(5);
      expect(mockNotificationHelper.send).toHaveBeenCalled();
    });

    it('should throw if job not completed', async () => {
      mockAssignmentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('u1', { jobId: 'j1', revieweeId: 'u2', rating: 5 }),
      ).rejects.toThrow();
    });

    it('should throw if duplicate review', async () => {
      mockAssignmentRepo.findOne.mockResolvedValue(mockAssignment);
      mockReviewRepo.findOne.mockResolvedValue(mockReview);
      await expect(
        service.create('u1', { jobId: 'j1', revieweeId: 'u2', rating: 5 }),
      ).rejects.toThrow();
    });
  });

  describe('findByJob', () => {
    it('should return paginated reviews', async () => {
      mockReviewRepo.findAndCount.mockResolvedValue([[mockReview], 1]);
      const result = await service.findByJob('j1');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findByUser', () => {
    it('should return user reviews', async () => {
      mockReviewRepo.findAndCount.mockResolvedValue([[mockReview], 1]);
      const result = await service.findByUser('u2');
      expect(result.data).toHaveLength(1);
    });
  });
});
