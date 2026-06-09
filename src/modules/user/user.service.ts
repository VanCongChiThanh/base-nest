import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, BankAccount } from './entities';
import {
  CreateUserDto,
  UpdateUserDto,
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto';
import * as bcrypt from 'bcrypt';
import {
  USER_ERRORS,
  NotFoundException,
  ConflictException,
  BadRequestException,
  AuthProvider,
  Role,
  VerificationLevel,
} from '../../common';
import { ProfileService } from '../profile/profile.service';
import { CreateOrganizationDto, CreateRecruiterDto } from './dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BankAccount)
    private readonly bankAccountRepository: Repository<BankAccount>,
    private readonly profileService: ProfileService,
  ) {}

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if email already exists
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException(USER_ERRORS.USER_EMAIL_EXISTS);
    }

    const user = this.userRepository.create(createUserDto);

    // Hash password
    if (createUserDto.password) {
      user.password = await bcrypt.hash(createUserDto.password, 10);
    }

    return this.userRepository.save(user);
  }

  /**
   * Create an organization account (Admin)
   */
  async createOrganization(dto: CreateOrganizationDto): Promise<User> {
    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(USER_ERRORS.USER_EMAIL_EXISTS);
    }

    const user = this.userRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: Role.ORGANIZATION,
      isEmailVerified: true,
      verificationLevel: VerificationLevel.BUSINESS,
    });
    user.password = await bcrypt.hash(dto.password, 10);
    const savedUser = await this.userRepository.save(user);

    await this.profileService.createEmployerProfile(
      savedUser.id,
      {
        companyName: dto.companyName,
        companyDescription: '',
      },
      true,
    );

    return savedUser;
  }

  /**
   * Create a recruiter account for an organization
   */
  async createRecruiter(
    organizationId: string,
    dto: CreateRecruiterDto,
  ): Promise<User> {
    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(USER_ERRORS.USER_EMAIL_EXISTS);
    }

    const user = this.userRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: Role.RECRUITER,
      isEmailVerified: true,
      organizationId,
    });
    user.password = await bcrypt.hash(dto.password, 10);
    return this.userRepository.save(user);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(USER_ERRORS.USER_NOT_FOUND);
    }
    return user;
  }

  /**
   * Public profile: safe user fields plus a summary of any worker/employer
   * profile (ratings, completed/posted jobs) so individual employers and
   * workers both have a meaningful public page.
   */
  async getPublicProfile(id: string) {
    const user = await this.findById(id);

    let workerProfile: {
      ratingAvg: number;
      totalReviews: number;
      totalJobsCompleted: number;
      bio: string | null;
    } | null = null;
    let employerProfile: {
      ratingAvg: number;
      totalReviews: number;
      totalJobsPosted: number;
      companyName: string | null;
      companyDescription: string | null;
    } | null = null;

    try {
      const wp = await this.profileService.getWorkerProfile(id);
      workerProfile = {
        ratingAvg: Number(wp.ratingAvg) || 0,
        totalReviews: wp.totalReviews ?? 0,
        totalJobsCompleted: wp.totalJobsCompleted ?? 0,
        bio: wp.bio ?? null,
      };
    } catch {
      // user has no worker profile
    }

    try {
      const ep = await this.profileService.getEmployerProfileByUserId(id);
      employerProfile = {
        ratingAvg: Number(ep.ratingAvg) || 0,
        totalReviews: ep.totalReviews ?? 0,
        totalJobsPosted: ep.totalJobsPosted ?? 0,
        companyName: ep.companyName ?? null,
        companyDescription: ep.companyDescription ?? null,
      };
    } catch {
      // user has no employer profile
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      verificationLevel: user.verificationLevel,
      createdAt: user.createdAt,
      workerProfile,
      employerProfile,
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Find user by social provider account
   */
  async findByProvider(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        providers: { provider, providerId },
      },
      relations: ['providers'],
    });
  }

  /**
   * Update user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  /**
   * Update user (internal - allow updating any field)
   */
  async updateInternal(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findById(id);
  }

  /**
   * Save user (internal)
   */
  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  /**
   * Get all user IDs
   */
  async findAllIds(): Promise<string[]> {
    const users = await this.userRepository.find({ select: ['id'] });
    return users.map((u) => u.id);
  }

  /**
   * Find all users with pagination, search, and filters (Admin)
   */
  async findAll(options: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    isEmailVerified?: boolean;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      isEmailVerified,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = options;

    const qb = this.userRepository.createQueryBuilder('user');

    if (search) {
      qb.where(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      qb.andWhere('user.role = :role', { role });
    }

    if (isEmailVerified !== undefined) {
      qb.andWhere('user.isEmailVerified = :isEmailVerified', {
        isEmailVerified,
      });
    }

    const allowedSortFields = [
      'createdAt',
      'email',
      'firstName',
      'lastName',
      'role',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    qb.orderBy(`user.${safeSortBy}`, sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Update user role (Admin)
   */
  async updateRole(id: string, role: string): Promise<User> {
    if (!Object.values(Role).includes(role as Role)) {
      throw new BadRequestException(USER_ERRORS.USER_ROLE_INVALID);
    }

    const user = await this.findById(id);
    user.role = role as Role;
    return this.userRepository.save(user);
  }

  /**
   * Delete user (Admin)
   */
  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }
  /**
   * Find user by verification token
   */
  findByVerificationToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { verificationToken: token },
    });
  }
  /**
   * Find user by reset password token
   */
  findByResetPasswordToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { resetPasswordToken: token },
    });
  }

  // ==================== BANK ACCOUNTS ====================

  async getBankAccounts(userId: string): Promise<BankAccount[]> {
    return this.bankAccountRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async addBankAccount(
    userId: string,
    dto: CreateBankAccountDto,
  ): Promise<BankAccount> {
    const existing = await this.bankAccountRepository.find({
      where: { userId },
    });
    if (existing.length >= 5) {
      throw new BadRequestException(USER_ERRORS.USER_BANK_LIMIT_EXCEEDED);
    }

    if (dto.isDefault) {
      // Remove default from others
      await this.bankAccountRepository.update({ userId }, { isDefault: false });
    }

    const bankAccount = this.bankAccountRepository.create({
      ...dto,
      userId,
      isDefault: existing.length === 0 ? true : (dto.isDefault ?? false),
    });

    return this.bankAccountRepository.save(bankAccount);
  }

  async updateBankAccount(
    userId: string,
    id: string,
    dto: UpdateBankAccountDto,
  ): Promise<BankAccount> {
    const bankAccount = await this.bankAccountRepository.findOne({
      where: { id, userId },
    });
    if (!bankAccount)
      throw new NotFoundException(USER_ERRORS.USER_BANK_NOT_FOUND);

    if (dto.isDefault) {
      await this.bankAccountRepository.update({ userId }, { isDefault: false });
    }

    Object.assign(bankAccount, dto);
    return this.bankAccountRepository.save(bankAccount);
  }

  async deleteBankAccount(userId: string, id: string): Promise<void> {
    const bankAccount = await this.bankAccountRepository.findOne({
      where: { id, userId },
    });
    if (!bankAccount)
      throw new NotFoundException(USER_ERRORS.USER_BANK_NOT_FOUND);

    await this.bankAccountRepository.remove(bankAccount);
  }
}
