import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities';
import { CreateUserDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcrypt';
import {
  USER_ERRORS,
  NotFoundException,
  ConflictException,
  AuthProvider,
} from '../../common';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
    const user = await this.findById(id);
    user.role = role as any;
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
}
