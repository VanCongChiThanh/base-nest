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
   * Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleId } });
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
