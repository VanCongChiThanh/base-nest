import 'dotenv/config';
import { DataSource } from 'typeorm';

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

/**
 * One-off maintenance script: recompute every profile's ratingAvg / totalReviews
 * from the real `reviews` table. This replaces any seed/fake values so that the
 * UI shows trustworthy aggregates.
 *
 * Run with: npm run recompute:ratings
 */
async function recomputeRatings() {
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
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('📦 Database connected');

  const reviewRepo = dataSource.getRepository(Review);
  const workerRepo = dataSource.getRepository(WorkerProfile);
  const employerRepo = dataSource.getRepository(EmployerProfile);

  // 1. Reset all aggregates so stale/fake values are wiped.
  await workerRepo
    .createQueryBuilder()
    .update()
    .set({ ratingAvg: 0, totalReviews: 0 })
    .execute();
  await employerRepo
    .createQueryBuilder()
    .update()
    .set({ ratingAvg: 0, totalReviews: 0 })
    .execute();
  console.log('🧹 Cleared existing rating aggregates');

  // 2. Aggregate from real reviews, grouped by reviewee.
  const rows = await reviewRepo
    .createQueryBuilder('review')
    .select('review.reviewee_id', 'userId')
    .addSelect('AVG(review.rating)', 'avg')
    .addSelect('COUNT(review.id)', 'count')
    .groupBy('review.reviewee_id')
    .getRawMany<{ userId: string; avg: string; count: string }>();

  let updated = 0;
  for (const row of rows) {
    const total = parseInt(row.count, 10) || 0;
    const avg = row.avg ? Math.round(parseFloat(row.avg) * 100) / 100 : 0;

    await workerRepo.update(
      { userId: row.userId },
      { ratingAvg: avg, totalReviews: total },
    );
    await employerRepo.update(
      { userId: row.userId },
      { ratingAvg: avg, totalReviews: total },
    );
    updated += 1;
  }

  console.log(
    `✅ Recomputed ratings for ${updated} user(s) from ${rows.reduce(
      (sum, r) => sum + (parseInt(r.count, 10) || 0),
      0,
    )} review(s)`,
  );

  await dataSource.destroy();
  console.log('🔌 Database connection closed');
}

recomputeRatings().catch((err) => {
  console.error('❌ Failed to recompute ratings:', err);
  process.exit(1);
});
