import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { User } from './modules/user/entities/user.entity';
import { EmployerProfile } from './modules/profile/entities/employer-profile.entity';
import { WorkerProfile } from './modules/profile/entities/worker-profile.entity';
import { JobCategory } from './modules/job-category/entities/job-category.entity';
import { Job } from './modules/job/entities/job.entity';
import { WorkerServiceEntity, ServiceType } from './modules/worker-service/entities/worker-service.entity';
import { Role } from './common/enums/role.enum';
import { JobStatus } from './common/enums/job-status.enum';

const FIRST_NAMES = ['Anh', 'Bình', 'Châu', 'Dũng', 'Đức', 'Hải', 'Hưng', 'Linh', 'Minh', 'Ngọc', 'Phong', 'Quyên', 'Sơn', 'Trang', 'Tuấn', 'Yến'];
const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const CITIES = [1, 79, 48]; // HN, HCM, ĐN

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function runFakeData() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'nestjs_base',
    entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('📦 Database connected');

  const userRepo = dataSource.getRepository(User);
  const employerProfileRepo = dataSource.getRepository(EmployerProfile);
  const workerProfileRepo = dataSource.getRepository(WorkerProfile);
  const categoryRepo = dataSource.getRepository(JobCategory);
  const jobRepo = dataSource.getRepository(Job);
  const workerServiceRepo = dataSource.getRepository(WorkerServiceEntity);

  const categories = await categoryRepo.find();
  if (categories.length === 0) {
    console.log('❌ Lỗi: Bạn cần chạy lệnh `npm run seed` 1 lần (dữ liệu mặc định) để có JobCategory trước khi tạo data ảo!');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash('123456', 10);
  
  // Tạo 5 Employer
  console.log('🔄 Đang tạo 5 Nhà tuyển dụng mới...');
  const newEmployers: User[] = [];
  for (let i = 0; i < 5; i++) {
    const fn = randomEl(FIRST_NAMES);
    const ln = randomEl(LAST_NAMES);
    const email = `emp_${uuidv4().substring(0, 8)}@gigjob.vn`;
    
    const emp = await userRepo.save(
      userRepo.create({
        email,
        password: hashedPassword,
        firstName: fn,
        lastName: ln,
        role: Role.USER,
        isEmailVerified: true,
      })
    );
    newEmployers.push(emp);

    await employerProfileRepo.save(
      employerProfileRepo.create({
        userId: emp.id,
        companyName: `Công ty TNHH ${fn} ${ln}`,
        companyDescription: `Cửa hàng / Công ty của ${fn} ${ln} cung cấp dịch vụ xuất sắc.`,
        phone: `09${randomInt(10000000, 99999999)}`,
        provinceCode: randomEl(CITIES),
        wardCode: randomInt(1, 100),
        address: `${randomInt(1, 999)} Đường ABC`,
        ratingAvg: randomInt(35, 50) / 10,
      })
    );
  }

  // Tạo 10 Worker
  console.log('🔄 Đang tạo 10 Ứng viên mới...');
  const newWorkers: User[] = [];
  for (let i = 0; i < 10; i++) {
    const fn = randomEl(FIRST_NAMES);
    const ln = randomEl(LAST_NAMES);
    const email = `worker_${uuidv4().substring(0, 8)}@gigjob.vn`;

    const worker = await userRepo.save(
      userRepo.create({
        email,
        password: hashedPassword,
        firstName: fn,
        lastName: ln,
        role: Role.USER,
        isEmailVerified: true,
      })
    );
    newWorkers.push(worker);

    await workerProfileRepo.save(
      workerProfileRepo.create({
        userId: worker.id,
        bio: `Xin chào, tôi là ${fn}. Tôi rất chăm chỉ và có trách nhiệm.`,
        phone: `08${randomInt(10000000, 99999999)}`,
        dateOfBirth: new Date(1990 + randomInt(0, 10), randomInt(0, 11), randomInt(1, 28)),
        provinceCode: randomEl(CITIES),
        wardCode: randomInt(1, 100),
        address: `${randomInt(1, 999)} Phố XYZ`,
        isAvailable: true,
        ratingAvg: randomInt(40, 50) / 10,
        totalJobsCompleted: randomInt(0, 20),
      })
    );
  }

  // Tạo 15 Jobs
  console.log('🔄 Đang tạo 15 Công việc mới...');
  for (let i = 0; i < 15; i++) {
    const emp = randomEl(newEmployers);
    const cat = randomEl(categories);
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + randomInt(1, 5));
    const endTime = new Date(startTime.getTime() + randomInt(2, 8) * 3600 * 1000);

    await jobRepo.save(
      jobRepo.create({
        employerId: emp.id,
        categoryId: cat.id,
        title: `Cần gấp nhân viên ${cat.name.toLowerCase()} theo giờ`,
        description: `Chúng tôi cần người làm việc chăm chỉ, đúng giờ. Yêu cầu có kinh nghiệm cơ bản về ${cat.name}. Công việc linh hoạt, môi trường thân thiện.`,
        salaryPerHour: randomInt(25, 80) * 1000,
        requiredWorkers: randomInt(1, 5),
        startTime,
        endTime,
        provinceCode: randomEl(CITIES),
        wardCode: randomInt(1, 100),
        address: `Số ${randomInt(1, 200)} Khu vực trung tâm`,
        status: JobStatus.OPEN,
      })
    );
  }

  // Tạo 15 Worker Services
  console.log('🔄 Đang tạo 15 Worker Services mới...');
  for (let i = 0; i < 15; i++) {
    const worker = randomEl(newWorkers);
    const cat = randomEl(categories);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 30 * 24 * 3600 * 1000);

    await workerServiceRepo.save(
      workerServiceRepo.create({
        workerId: worker.id,
        categoryId: cat.id,
        title: `Nhận làm ${cat.name.toLowerCase()} bán thời gian / sự kiện`,
        description: `Tôi có thể làm việc ${cat.name.toLowerCase()} chuyên nghiệp. Tôi đảm bảo hoàn thành tốt công việc được giao, không ngại khó khăn.`,
        startTime,
        endTime,
        price: randomInt(30, 100) * 1000,
        priceType: 'HOURLY',
        isNegotiable: true,
        provinceCode: randomEl(CITIES).toString(),
        wardCode: randomInt(1, 100).toString(),
        type: ServiceType.BOTH,
        isAvailableNow: true,
        isActive: true,
      })
    );
  }

  console.log('✅ HOÀN TẤT! Đã thêm thành công: 5 Employers, 10 Workers, 15 Jobs, 15 WorkerServices.');
  console.log('🚀 Mẹo: Bây giờ bạn có thể gọi API GET /ai/dev-sync để đồng bộ toàn bộ đống dữ liệu này vào GraphRAG!');
  process.exit(0);
}

runFakeData().catch(console.error);
