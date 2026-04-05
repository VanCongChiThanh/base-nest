import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Entities
import { User } from './modules/user/entities';
import { UserProvider } from './modules/auth/entities/user-provider.entity';
import { EmployerProfile } from './modules/profile/entities/employer-profile.entity';
import { WorkerProfile } from './modules/profile/entities/worker-profile.entity';
import { WorkerSkill } from './modules/profile/entities/worker-skill.entity';
import { Skill } from './modules/skill/entities/skill.entity';
import { JobCategory } from './modules/job-category/entities/job-category.entity';
import { Job } from './modules/job/entities/job.entity';
import { JobSkill } from './modules/job/entities/job-skill.entity';
import { JobApplication } from './modules/job/entities/job-application.entity';
import { JobAssignment } from './modules/job/entities/job-assignment.entity';
import { Review } from './modules/review/entities/review.entity';
import { Notification } from './modules/notification/entities/notification.entity';
import { PaymentConfirmation } from './modules/payment/entities/payment-confirmation.entity';
import { Dispute } from './modules/payment/entities/dispute.entity';
import { VerificationRequest } from './modules/verification/entities/verification-request.entity';
import { EkycResult } from './modules/verification/entities/ekyc-result.entity';
import { SubscriptionPlan } from './modules/subscription/entities/subscription-plan.entity';
import { UserSubscription } from './modules/subscription/entities/user-subscription.entity';
import { Report } from './modules/report/entities/report.entity';

// Enums
import { Role } from './common/enums/role.enum';
import { AuthProvider } from './common/enums/auth-provider.enum';
import { JobStatus } from './common/enums/job-status.enum';
import { ApplicationStatus } from './common/enums/application-status.enum';
import { AssignmentStatus } from './common/enums/assignment-status.enum';
import { PaymentType, PaymentStatus } from './common/enums/payment-status.enum';
import { EmployerBadge } from './common/enums/employer-badge.enum';
import { SubscriptionStatus } from './common/enums/subscription-status.enum';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Seed is not allowed in production environment!');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'nestjs_base',
    entities: [
      User,
      UserProvider,
      EmployerProfile,
      WorkerProfile,
      WorkerSkill,
      Skill,
      JobCategory,
      Job,
      JobSkill,
      JobApplication,
      JobAssignment,
      Review,
      Notification,
      PaymentConfirmation,
      Dispute,
      VerificationRequest,
      EkycResult,
      SubscriptionPlan,
      UserSubscription,
      Report,
    ],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('📦 Database connected');

  // Clean up existing data (reverse FK order)
  const entities = dataSource.entityMetadatas;
  for (const entity of entities) {
    const repo = dataSource.getRepository(entity.name);
    await repo.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE`);
  }
  console.log('🧹 Existing data cleaned');

  // Hash password for all seed users
  const hashedPassword = await bcrypt.hash('123456', 10);

  // ──────────────────── USERS ────────────────────
  const userRepo = dataSource.getRepository(User);
  const providerRepo = dataSource.getRepository(UserProvider);

  const admin = userRepo.create({
    email: 'admin@gigjob.vn',
    password: hashedPassword,
    firstName: 'Admin',
    lastName: 'System',
    role: Role.ADMIN,
    isEmailVerified: true,
  });

  const employer1 = userRepo.create({
    email: 'employer1@gigjob.vn',
    password: hashedPassword,
    firstName: 'Minh',
    lastName: 'Nguyễn',
    role: Role.USER,
    isEmailVerified: true,
  });

  const employer2 = userRepo.create({
    email: 'employer2@gigjob.vn',
    password: hashedPassword,
    firstName: 'Hương',
    lastName: 'Trần',
    role: Role.USER,
    isEmailVerified: true,
  });

  const worker1 = userRepo.create({
    email: 'worker1@gigjob.vn',
    password: hashedPassword,
    firstName: 'Tuấn',
    lastName: 'Lê',
    role: Role.USER,
    isEmailVerified: true,
  });

  const worker2 = userRepo.create({
    email: 'worker2@gigjob.vn',
    password: hashedPassword,
    firstName: 'Linh',
    lastName: 'Phạm',
    role: Role.USER,
    isEmailVerified: true,
  });

  const worker3 = userRepo.create({
    email: 'worker3@gigjob.vn',
    password: hashedPassword,
    firstName: 'Đức',
    lastName: 'Hoàng',
    role: Role.USER,
    isEmailVerified: true,
  });

  const savedUsers = await userRepo.save([
    admin,
    employer1,
    employer2,
    worker1,
    worker2,
    worker3,
  ]);

  const [
    savedAdmin,
    savedEmployer1,
    savedEmployer2,
    savedWorker1,
    savedWorker2,
    savedWorker3,
  ] = savedUsers;

  // Link local providers
  const providers = savedUsers.map((u) =>
    providerRepo.create({
      provider: AuthProvider.LOCAL,
      providerId: u.id,
      user: u,
    }),
  );
  await providerRepo.save(providers);
  console.log(`✅ ${savedUsers.length} users created`);

  // ──────────────────── SKILLS ────────────────────
  const skillRepo = dataSource.getRepository(Skill);
  const skillsData = [
    { name: 'Phục vụ', description: 'Phục vụ nhà hàng, quán ăn, sự kiện' },
    { name: 'Pha chế', description: 'Barista, bartender, pha chế đồ uống' },
    { name: 'Nấu ăn', description: 'Đầu bếp, phụ bếp, chế biến thức ăn' },
    { name: 'Bán hàng', description: 'Nhân viên bán hàng tại cửa hàng' },
    { name: 'Khuân vác', description: 'Bốc xếp, vận chuyển hàng hoá' },
    { name: 'Lái xe', description: 'Lái xe tải, xe máy giao hàng' },
    { name: 'Dọn dẹp', description: 'Vệ sinh công nghiệp, dọn nhà' },
    { name: 'Marketing', description: 'Phát tờ rơi, tiếp thị sản phẩm' },
    { name: 'Chụp ảnh', description: 'Chụp ảnh sự kiện, sản phẩm' },
    { name: 'MC', description: 'Dẫn chương trình sự kiện' },
    { name: 'Gia sư', description: 'Dạy kèm các môn học' },
    { name: 'Thiết kế', description: 'Thiết kế đồ hoạ, banner, poster' },
  ];
  const savedSkills = await skillRepo.save(
    skillsData.map((s) => skillRepo.create(s)),
  );
  console.log(`✅ ${savedSkills.length} skills created`);

  // ──────────────────── JOB CATEGORIES ────────────────────
  const catRepo = dataSource.getRepository(JobCategory);
  const categoriesData = [
    {
      name: 'Nhà hàng & Khách sạn',
      description: 'Công việc tại nhà hàng, quán ăn, khách sạn',
      icon: '🍽️',
    },
    {
      name: 'Sự kiện',
      description: 'Phục vụ, setup, dọn dẹp sự kiện',
      icon: '🎪',
    },
    { name: 'Giao hàng', description: 'Giao hàng, vận chuyển', icon: '🚚' },
    {
      name: 'Bán lẻ',
      description: 'Bán hàng tại cửa hàng, siêu thị',
      icon: '🛒',
    },
    {
      name: 'Vệ sinh',
      description: 'Dọn dẹp, vệ sinh công nghiệp',
      icon: '🧹',
    },
    {
      name: 'Gia sư & Đào tạo',
      description: 'Dạy kèm, huấn luyện',
      icon: '📚',
    },
    {
      name: 'Marketing & Quảng cáo',
      description: 'Tiếp thị, khảo sát, phát tờ rơi',
      icon: '📢',
    },
    {
      name: 'IT & Thiết kế',
      description: 'Lập trình, thiết kế đồ hoạ',
      icon: '💻',
    },
    {
      name: 'Xây dựng & Sửa chữa',
      description: 'Thợ xây, sơn, điện nước',
      icon: '🔧',
    },
    { name: 'Khác', description: 'Các công việc khác', icon: '📋' },
  ];
  const savedCategories = await catRepo.save(
    categoriesData.map((c) => catRepo.create(c)),
  );
  console.log(`✅ ${savedCategories.length} categories created`);

  // ──────────────────── PROFILES ────────────────────
  const empProfileRepo = dataSource.getRepository(EmployerProfile);
  const workerProfileRepo = dataSource.getRepository(WorkerProfile);
  const workerSkillRepo = dataSource.getRepository(WorkerSkill);

  // Employer profiles
  const empProfile1 = await empProfileRepo.save(
    empProfileRepo.create({
      userId: savedEmployer1.id,
      companyName: 'Nhà hàng Phở Minh',
      companyDescription:
        'Chuỗi nhà hàng phở truyền thống Hà Nội, hoạt động từ 2010',
      phone: '0901234567',
      provinceCode: 1, // Hà Nội
      wardCode: 4,
      address: '123 Phố Huế, Hai Bà Trưng',
      ratingAvg: 4.5,
      totalReviews: 12,
      totalJobsPosted: 8,
      trustScore: 75,
      badge: EmployerBadge.TRUSTED,
    }),
  );

  const empProfile2 = await empProfileRepo.save(
    empProfileRepo.create({
      userId: savedEmployer2.id,
      companyName: 'Công ty TNHH Sự kiện Hương Trần',
      companyDescription: 'Tổ chức sự kiện, hội nghị, tiệc cưới chuyên nghiệp',
      phone: '0912345678',
      provinceCode: 79, // TP.HCM
      wardCode: 26734,
      address: '456 Nguyễn Huệ, Quận 1',
      ratingAvg: 4.8,
      totalReviews: 25,
      totalJobsPosted: 15,
      trustScore: 88,
      badge: EmployerBadge.TOP,
      isVerifiedBusiness: true,
    }),
  );

  // Worker profiles
  const workerProfile1 = await workerProfileRepo.save(
    workerProfileRepo.create({
      userId: savedWorker1.id,
      bio: 'Sinh viên năm 3 ĐH Bách Khoa, có kinh nghiệm phục vụ nhà hàng 2 năm',
      phone: '0923456789',
      dateOfBirth: new Date('2003-05-15'),
      provinceCode: 1,
      wardCode: 7,
      address: '78 Đội Cấn, Ba Đình',
      isAvailable: true,
      ratingAvg: 4.7,
      totalReviews: 8,
      totalJobsCompleted: 10,
    }),
  );

  const workerProfile2 = await workerProfileRepo.save(
    workerProfileRepo.create({
      userId: savedWorker2.id,
      bio: 'Nhân viên tự do, chuyên phục vụ sự kiện và pha chế',
      phone: '0934567890',
      dateOfBirth: new Date('2001-08-20'),
      provinceCode: 79,
      wardCode: 26740,
      address: '25 Lý Tự Trọng, Quận 1',
      isAvailable: true,
      ratingAvg: 4.3,
      totalReviews: 5,
      totalJobsCompleted: 6,
    }),
  );

  const workerProfile3 = await workerProfileRepo.save(
    workerProfileRepo.create({
      userId: savedWorker3.id,
      bio: 'Tốt nghiệp trung cấp du lịch, có bằng lái xe B2',
      phone: '0945678901',
      dateOfBirth: new Date('2000-12-01'),
      provinceCode: 48, // Đà Nẵng
      wardCode: 20194,
      address: '99 Nguyễn Văn Linh, Hải Châu',
      isAvailable: true,
      ratingAvg: 4.0,
      totalReviews: 3,
      totalJobsCompleted: 4,
    }),
  );

  // Worker skills
  const workerSkillsData = [
    {
      workerProfileId: workerProfile1.id,
      skillId: savedSkills[0].id,
      yearsOfExperience: 2,
    }, // Phục vụ
    {
      workerProfileId: workerProfile1.id,
      skillId: savedSkills[1].id,
      yearsOfExperience: 1,
    }, // Pha chế
    {
      workerProfileId: workerProfile1.id,
      skillId: savedSkills[4].id,
      yearsOfExperience: 1,
    }, // Khuân vác
    {
      workerProfileId: workerProfile2.id,
      skillId: savedSkills[0].id,
      yearsOfExperience: 3,
    }, // Phục vụ
    {
      workerProfileId: workerProfile2.id,
      skillId: savedSkills[1].id,
      yearsOfExperience: 2,
    }, // Pha chế
    {
      workerProfileId: workerProfile2.id,
      skillId: savedSkills[9].id,
      yearsOfExperience: 1,
    }, // MC
    {
      workerProfileId: workerProfile3.id,
      skillId: savedSkills[5].id,
      yearsOfExperience: 3,
    }, // Lái xe
    {
      workerProfileId: workerProfile3.id,
      skillId: savedSkills[4].id,
      yearsOfExperience: 2,
    }, // Khuân vác
    {
      workerProfileId: workerProfile3.id,
      skillId: savedSkills[6].id,
      yearsOfExperience: 1,
    }, // Dọn dẹp
  ];
  await workerSkillRepo.save(
    workerSkillsData.map((ws) => workerSkillRepo.create(ws)),
  );

  console.log('✅ Profiles & worker skills created');

  // ──────────────────── JOBS ────────────────────
  const jobRepo = dataSource.getRepository(Job);
  const jobSkillRepo = dataSource.getRepository(JobSkill);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextWeekEnd = new Date(nextWeek.getTime() + 8 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const job1 = await jobRepo.save(
    jobRepo.create({
      employerId: savedEmployer1.id,
      categoryId: savedCategories[0].id, // Nhà hàng
      title: 'Phục vụ nhà hàng cuối tuần',
      description:
        'Cần tuyển 3 bạn phục vụ nhà hàng vào thứ 7 & chủ nhật. Yêu cầu: ngoại hình ưa nhìn, giao tiếp tốt, đúng giờ. Có phụ cấp ăn trưa.',
      salaryPerHour: 35000,
      requiredWorkers: 3,
      startTime: nextWeek,
      endTime: nextWeekEnd,
      provinceCode: 1,
      wardCode: 4,
      address: '123 Phố Huế, Hai Bà Trưng, Hà Nội',
      status: JobStatus.OPEN,
    }),
  );

  const job2 = await jobRepo.save(
    jobRepo.create({
      employerId: savedEmployer1.id,
      categoryId: savedCategories[0].id,
      title: 'Phụ bếp buổi tối',
      description:
        'Tìm 1 phụ bếp làm việc từ 17h-22h hàng ngày. Công việc: sơ chế nguyên liệu, rửa bát, dọn dẹp bếp. Ưu tiên có kinh nghiệm.',
      salaryPerHour: 30000,
      requiredWorkers: 1,
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000),
      provinceCode: 1,
      wardCode: 7,
      address: '45 Đội Cấn, Ba Đình, Hà Nội',
      status: JobStatus.OPEN,
    }),
  );

  const job3 = await jobRepo.save(
    jobRepo.create({
      employerId: savedEmployer2.id,
      categoryId: savedCategories[1].id, // Sự kiện
      title: 'Phục vụ tiệc cưới 200 khách',
      description:
        'Cần 5 bạn phục vụ tiệc cưới tại khách sạn 5 sao. Yêu cầu: mặc đồng phục (được cung cấp), thái độ chuyên nghiệp. Bao ăn + xe đưa đón.',
      salaryPerHour: 50000,
      requiredWorkers: 5,
      startTime: nextWeek,
      endTime: new Date(nextWeek.getTime() + 6 * 60 * 60 * 1000),
      provinceCode: 79,
      wardCode: 26734,
      address: '456 Nguyễn Huệ, Quận 1, TP.HCM',
      status: JobStatus.OPEN,
    }),
  );

  const job4 = await jobRepo.save(
    jobRepo.create({
      employerId: savedEmployer2.id,
      categoryId: savedCategories[6].id, // Marketing
      title: 'Phát tờ rơi khai trương',
      description:
        'Phát tờ rơi quảng cáo khai trương cửa hàng mới tại khu vực Quận 7. Thời gian linh hoạt, có thể làm buổi sáng hoặc chiều.',
      salaryPerHour: 25000,
      requiredWorkers: 4,
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000),
      provinceCode: 79,
      wardCode: 26908,
      address: '789 Nguyễn Thị Thập, Quận 7, TP.HCM',
      status: JobStatus.OPEN,
    }),
  );

  const job5 = await jobRepo.save(
    jobRepo.create({
      employerId: savedEmployer1.id,
      categoryId: savedCategories[2].id, // Giao hàng
      title: 'Giao hàng nội thành buổi sáng',
      description:
        'Giao hàng cho các đơn online trong khu vực nội thành Hà Nội. Yêu cầu: có xe máy, biết đường Hà Nội. Xăng xe tự lo.',
      salaryPerHour: 40000,
      requiredWorkers: 2,
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000),
      provinceCode: 1,
      wardCode: 4,
      address: '10 Bà Triệu, Hoàn Kiếm, Hà Nội',
      status: JobStatus.OPEN,
    }),
  );

  // Completed job for reviews/payments
  const job6 = await jobRepo.save(
    jobRepo.create({
      employerId: savedEmployer2.id,
      categoryId: savedCategories[1].id,
      title: 'Setup sự kiện hội nghị công nghệ',
      description: 'Dọn dẹp, setup bàn ghế, trang trí cho hội nghị công nghệ.',
      salaryPerHour: 45000,
      requiredWorkers: 2,
      startTime: new Date(yesterday.getTime() - 8 * 60 * 60 * 1000),
      endTime: yesterday,
      provinceCode: 79,
      wardCode: 26734,
      address: '100 Pasteur, Quận 1, TP.HCM',
      status: JobStatus.CLOSED,
    }),
  );

  // Cancelled job
  const job7 = await jobRepo.save(
    jobRepo.create({
      employerId: savedEmployer1.id,
      categoryId: savedCategories[4].id, // Vệ sinh
      title: 'Dọn dẹp văn phòng sau Tết',
      description: 'Vệ sinh tổng thể văn phòng công ty sau kỳ nghỉ Tết.',
      salaryPerHour: 35000,
      requiredWorkers: 3,
      startTime: yesterday,
      endTime: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000),
      provinceCode: 1,
      wardCode: 10,
      address: '200 Cầu Giấy, Cầu Giấy, Hà Nội',
      status: JobStatus.CANCELLED,
    }),
  );

  console.log('✅ 7 jobs created');

  // Job skills
  const jobSkillsData = [
    { jobId: job1.id, skillId: savedSkills[0].id }, // Phục vụ
    { jobId: job2.id, skillId: savedSkills[2].id }, // Nấu ăn
    { jobId: job2.id, skillId: savedSkills[6].id }, // Dọn dẹp
    { jobId: job3.id, skillId: savedSkills[0].id }, // Phục vụ
    { jobId: job3.id, skillId: savedSkills[1].id }, // Pha chế
    { jobId: job4.id, skillId: savedSkills[7].id }, // Marketing
    { jobId: job5.id, skillId: savedSkills[5].id }, // Lái xe
    { jobId: job6.id, skillId: savedSkills[4].id }, // Khuân vác
    { jobId: job6.id, skillId: savedSkills[6].id }, // Dọn dẹp
    { jobId: job7.id, skillId: savedSkills[6].id }, // Dọn dẹp
  ];
  await jobSkillRepo.save(jobSkillsData.map((js) => jobSkillRepo.create(js)));
  console.log('✅ Job skills linked');

  // ──────────────────── APPLICATIONS & ASSIGNMENTS ────────────────────
  const appRepo = dataSource.getRepository(JobApplication);
  const assignRepo = dataSource.getRepository(JobAssignment);

  // Applications for job1 (Phục vụ nhà hàng)
  const app1 = await appRepo.save(
    appRepo.create({
      jobId: job1.id,
      workerId: savedWorker1.id,
      coverLetter: 'Em có 2 năm kinh nghiệm phục vụ, sẵn sàng làm cuối tuần ạ.',
      status: ApplicationStatus.ACCEPTED,
      respondedAt: new Date(),
    }),
  );
  const app2 = await appRepo.save(
    appRepo.create({
      jobId: job1.id,
      workerId: savedWorker2.id,
      coverLetter:
        'Em rất muốn được thử sức, em có kinh nghiệm phục vụ sự kiện.',
      status: ApplicationStatus.PENDING,
    }),
  );

  // Applications for job3 (Tiệc cưới)
  const app3 = await appRepo.save(
    appRepo.create({
      jobId: job3.id,
      workerId: savedWorker2.id,
      coverLetter: 'Em chuyên phục vụ sự kiện, từng làm nhiều tiệc cưới lớn.',
      status: ApplicationStatus.ACCEPTED,
      respondedAt: new Date(),
    }),
  );
  const app4 = await appRepo.save(
    appRepo.create({
      jobId: job3.id,
      workerId: savedWorker3.id,
      status: ApplicationStatus.PENDING,
    }),
  );

  // Applications for completed job6
  const app5 = await appRepo.save(
    appRepo.create({
      jobId: job6.id,
      workerId: savedWorker1.id,
      coverLetter: 'Em khoẻ, có thể khuân vác setup sự kiện.',
      status: ApplicationStatus.ACCEPTED,
      respondedAt: new Date(yesterday.getTime() - 3 * 24 * 60 * 60 * 1000),
    }),
  );
  const app6 = await appRepo.save(
    appRepo.create({
      jobId: job6.id,
      workerId: savedWorker3.id,
      coverLetter: 'Em có kinh nghiệm dọn dẹp sự kiện.',
      status: ApplicationStatus.ACCEPTED,
      respondedAt: new Date(yesterday.getTime() - 3 * 24 * 60 * 60 * 1000),
    }),
  );
  // Rejected application
  await appRepo.save(
    appRepo.create({
      jobId: job5.id,
      workerId: savedWorker1.id,
      coverLetter: 'Em muốn thử giao hàng ạ.',
      status: ApplicationStatus.REJECTED,
      respondedAt: new Date(),
    }),
  );

  // Assignments
  await assignRepo.save(
    assignRepo.create({
      jobId: job1.id,
      workerId: savedWorker1.id,
      applicationId: app1.id,
      status: AssignmentStatus.ASSIGNED,
    }),
  );
  await assignRepo.save(
    assignRepo.create({
      jobId: job3.id,
      workerId: savedWorker2.id,
      applicationId: app3.id,
      status: AssignmentStatus.ASSIGNED,
    }),
  );
  // Completed assignments for job6
  await assignRepo.save(
    assignRepo.create({
      jobId: job6.id,
      workerId: savedWorker1.id,
      applicationId: app5.id,
      status: AssignmentStatus.COMPLETED,
      startedAt: new Date(yesterday.getTime() - 8 * 60 * 60 * 1000),
      completedAt: yesterday,
    }),
  );
  await assignRepo.save(
    assignRepo.create({
      jobId: job6.id,
      workerId: savedWorker3.id,
      applicationId: app6.id,
      status: AssignmentStatus.COMPLETED,
      startedAt: new Date(yesterday.getTime() - 8 * 60 * 60 * 1000),
      completedAt: yesterday,
    }),
  );

  console.log('✅ Applications & assignments created');

  // ──────────────────── REVIEWS ────────────────────
  const reviewRepo = dataSource.getRepository(Review);

  // Employer reviews workers on job6
  await reviewRepo.save(
    reviewRepo.create({
      reviewerId: savedEmployer2.id,
      revieweeId: savedWorker1.id,
      jobId: job6.id,
      rating: 5,
      comment: 'Tuấn làm việc rất tích cực, đúng giờ, sẽ thuê lại!',
    }),
  );
  // Worker3 reviews employer on job6
  await reviewRepo.save(
    reviewRepo.create({
      reviewerId: savedWorker3.id,
      revieweeId: savedEmployer2.id,
      jobId: job6.id,
      rating: 4,
      comment: 'Công việc ổn, chị Hương hướng dẫn rõ ràng.',
    }),
  );
  // Worker reviews employer on job6
  await reviewRepo.save(
    reviewRepo.create({
      reviewerId: savedWorker1.id,
      revieweeId: savedEmployer2.id,
      jobId: job6.id,
      rating: 5,
      comment:
        'Chị Hương rất dễ tính, trả lương đúng hẹn, sự kiện chuyên nghiệp.',
    }),
  );

  console.log('✅ Reviews created');

  // ──────────────────── PAYMENT CONFIRMATIONS ────────────────────
  const paymentRepo = dataSource.getRepository(PaymentConfirmation);

  // Final payment confirmed for job6
  await paymentRepo.save(
    paymentRepo.create({
      jobId: job6.id,
      workerId: savedWorker1.id,
      employerId: savedEmployer2.id,
      type: PaymentType.FINAL_PAYMENT,
      amount: 360000,
      status: PaymentStatus.PAYMENT_CONFIRMED,
      confirmedByWorker: true,
      confirmedAt: yesterday,
      note: 'Đã nhận lương đủ',
    }),
  );

  console.log('✅ Payment confirmations created');

  // ──────────────────── SUBSCRIPTION PLANS ────────────────────
  const planRepo = dataSource.getRepository(SubscriptionPlan);

  const freePlan = await planRepo.save(
    planRepo.create({
      name: 'Miễn phí',
      price: 0,
      maxPostsPerMonth: 3,
      postExpiryDays: 7,
      featuredPosts: 0,
      isActive: true,
    }),
  );

  await planRepo.save(
    planRepo.create({
      name: 'Cơ bản',
      price: 99000,
      maxPostsPerMonth: 10,
      postExpiryDays: 15,
      featuredPosts: 2,
      isActive: true,
    }),
  );

  await planRepo.save(
    planRepo.create({
      name: 'Chuyên nghiệp',
      price: 299000,
      maxPostsPerMonth: 30,
      postExpiryDays: 30,
      featuredPosts: 5,
      isActive: true,
    }),
  );

  await planRepo.save(
    planRepo.create({
      name: 'Doanh nghiệp',
      price: 799000,
      maxPostsPerMonth: 999,
      postExpiryDays: 60,
      featuredPosts: 20,
      isActive: true,
    }),
  );

  console.log('✅ Subscription plans created');

  // ──────────────────── USER SUBSCRIPTIONS ────────────────────
  const userSubRepo = dataSource.getRepository(UserSubscription);

  await userSubRepo.save(
    userSubRepo.create({
      userId: savedEmployer2.id,
      planId: freePlan.id,
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 335 * 24 * 60 * 60 * 1000),
      status: SubscriptionStatus.ACTIVE,
    }),
  );

  console.log('✅ User subscriptions created');

  // ──────────────────── NOTIFICATIONS ────────────────────
  const notiRepo = dataSource.getRepository(Notification);

  await notiRepo.save([
    notiRepo.create({
      userId: savedWorker1.id,
      type: 'JOB_APPLICATION_ACCEPTED',
      refType: 'JOB_APPLICATION',
      refId: app1.id,
      data: { jobTitle: job1.title },
      isRead: false,
    } as Partial<Notification>),
    notiRepo.create({
      userId: savedEmployer1.id,
      type: 'JOB_APPLICATION_RECEIVED',
      refType: 'JOB_APPLICATION',
      refId: app2.id,
      data: { workerName: 'Linh Phạm', jobTitle: job1.title },
      isRead: false,
    } as Partial<Notification>),
    notiRepo.create({
      userId: savedEmployer2.id,
      type: 'REVIEW_RECEIVED',
      refType: 'REVIEW',
      refId: job6.id,
      data: { reviewerName: 'Tuấn Lê', rating: 5 },
      isRead: true,
    } as Partial<Notification>),
  ]);

  console.log('✅ Notifications created');

  // ──────────────────── DONE ────────────────────
  console.log('\n🎉 Seed data completed!');
  console.log('──────────────────────────────────────');
  console.log('📧 Accounts (password: 123456):');
  console.log('  Admin:     admin@gigjob.vn');
  console.log('  Employer:  employer1@gigjob.vn / employer2@gigjob.vn');
  console.log(
    '  Worker:    worker1@gigjob.vn / worker2@gigjob.vn / worker3@gigjob.vn',
  );
  console.log('──────────────────────────────────────');

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
