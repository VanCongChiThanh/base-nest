import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, BankAccount } from './entities';
import { ProfileService } from '../profile/profile.service';

describe('UserService', () => {
  let service: UserService;

  const mockUsers: Partial<User>[] = [
    {
      id: '1',
      email: 'test@test.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER' as any,
      isEmailVerified: true,
    },
    {
      id: '2',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN' as any,
      isEmailVerified: true,
    },
  ];

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([mockUsers, 2]),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(BankAccount), useValue: mockRepo },
        { provide: ProfileService, useValue: { createEmployerProfile: jest.fn(), createWorkerProfile: jest.fn() } },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return a user if found', async () => {
      mockRepo.findOne.mockResolvedValue(mockUsers[0]);
      const result = await service.findById('1');
      expect(result).toEqual(mockUsers[0]);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('999')).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      mockRepo.findOne.mockResolvedValue(mockUsers[0]);
      const result = await service.findByEmail('test@test.com');
      expect(result).toEqual(mockUsers[0]);
    });

    it('should return null if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('notexist@test.com');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      const user = { ...mockUsers[0] } as User;
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.save.mockResolvedValue({ ...user, firstName: 'Jane' });

      const result = await service.update('1', { firstName: 'Jane' });
      expect(result.firstName).toBe('Jane');
    });
  });

  describe('delete', () => {
    it('should remove the user', async () => {
      mockRepo.findOne.mockResolvedValue(mockUsers[0]);
      mockRepo.remove.mockResolvedValue(mockUsers[0]);

      await service.delete('1');
      expect(mockRepo.remove).toHaveBeenCalledWith(mockUsers[0]);
    });
  });
});
