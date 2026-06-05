import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationMessage, JobApplication, JobAssignment } from './entities';
import {
  ApplicationStatus,
  AssignmentStatus,
  JobType,
} from '../../common/enums';
import { APPLICATION_ERRORS } from '../../common/constants/error-codes.constant';
import { ApplicationChatGateway } from './application-chat.gateway';

@Injectable()
export class ApplicationChatService {
  constructor(
    @InjectRepository(ApplicationMessage)
    private readonly messageRepository: Repository<ApplicationMessage>,
    @InjectRepository(JobApplication)
    private readonly applicationRepository: Repository<JobApplication>,
    @InjectRepository(JobAssignment)
    private readonly assignmentRepository: Repository<JobAssignment>,
    @Inject(forwardRef(() => ApplicationChatGateway))
    private readonly applicationChatGateway: ApplicationChatGateway,
  ) {}

  /** Worker or employer of this application may read messages. */
  private async loadApplicationForUser(applicationId: string, userId: string) {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });
    if (!application) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }
    const job = application.job;
    const isWorker = application.workerId === userId;
    const isEmployer = job.employerId === userId;
    if (!isWorker && !isEmployer) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN,
      );
    }
    return application;
  }

  private async getAssignment(
    applicationId: string,
  ): Promise<JobAssignment | null> {
    return this.assignmentRepository.findOne({ where: { applicationId } });
  }

  /**
   * New messages allowed: ACCEPTED, not cancelled/rejected, assignment not COMPLETED/CANCELLED.
   */
  canSendNewMessages(
    application: JobApplication,
    assignment: JobAssignment | null,
  ): boolean {
    const isDirectHire =
      application.job?.isDirectHire ||
      application.coverLetter?.includes('Direct hire request');
    if (
      application.status !== ApplicationStatus.ACCEPTED &&
      application.status !== ApplicationStatus.EMPLOYER_ACCEPTED &&
      application.status !== ApplicationStatus.PENDING
    ) {
      return false;
    }

    // Đối với job ONLINE, luôn cho phép chat kể cả khi đã hoàn thành hoặc hủy
    if (application.job?.jobType === JobType.ONLINE) {
      return true;
    }

    if (!assignment) return true;
    if (assignment.status === AssignmentStatus.COMPLETED) return false;
    if (assignment.status === AssignmentStatus.CANCELLED) return false;
    return true;
  }

  async listMessages(applicationId: string, userId: string) {
    const application = await this.loadApplicationForUser(
      applicationId,
      userId,
    );
    // Nếu là ONLINE, cho phép đọc nếu đã từng được ACCEPTED (kể cả sau này có COMPLETED)
    // Để đơn giản, cứ là ONLINE và đã ACCEPTED thì cho phép (hoặc nếu yêu cầu luôn cho phép đọc)
    if (
      application.job?.jobType !== JobType.ONLINE &&
      application.status !== ApplicationStatus.ACCEPTED &&
      application.status !== ApplicationStatus.EMPLOYER_ACCEPTED &&
      application.status !== ApplicationStatus.PENDING
    ) {
      throw new ForbiddenException(APPLICATION_ERRORS.APPLICATION_CHAT_CLOSED);
    }
    const assignment = await this.getAssignment(applicationId);
    const messages = await this.messageRepository.find({
      where: { applicationId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
    return {
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt,
        senderId: m.senderId,
        sender: {
          id: m.sender.id,
          firstName: m.sender.firstName,
          lastName: m.sender.lastName,
          avatarUrl: m.sender.avatarUrl,
        },
      })),
      canSend: this.canSendNewMessages(application, assignment),
      jobDetails: {
        jobId: application.jobId,
        isDirectHire: Boolean(
          application.job?.isDirectHire ||
          application.coverLetter?.includes('Direct hire request'),
        ),
        employerId: application.job?.employerId ?? '',
        workerId: application.workerId,
        onlinePaymentType: application.job?.onlinePaymentType ?? null,
        salaryPerHour: application.job?.salaryPerHour ?? null,
        totalBudget: application.job?.totalBudget ?? null,
      },
    };
  }

  async postMessage(
    applicationId: string,
    userId: string,
    body: string,
  ): Promise<{ id: string; createdAt: Date }> {
    const application = await this.loadApplicationForUser(
      applicationId,
      userId,
    );
    const assignment = await this.getAssignment(applicationId);
    if (!this.canSendNewMessages(application, assignment)) {
      throw new ForbiddenException(APPLICATION_ERRORS.APPLICATION_CHAT_CLOSED);
    }
    const saved = await this.messageRepository.save(
      this.messageRepository.create({
        applicationId,
        senderId: userId,
        body: body.trim(),
      }),
    );

    const fullMessage = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['sender'],
    });

    if (fullMessage?.sender) {
      this.applicationChatGateway.emitNewMessage({
        applicationId,
        message: {
          id: fullMessage.id,
          body: fullMessage.body,
          createdAt: fullMessage.createdAt,
          senderId: fullMessage.senderId,
          sender: {
            id: fullMessage.sender.id,
            firstName: fullMessage.sender.firstName,
            lastName: fullMessage.sender.lastName,
            avatarUrl: fullMessage.sender.avatarUrl,
          },
        },
      });
    }

    return { id: saved.id, createdAt: saved.createdAt };
  }

  async listConversations(userId: string) {
    const applications = await this.applicationRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.job', 'job')
      .leftJoinAndSelect('job.employer', 'employer')
      .leftJoinAndSelect('application.worker', 'worker')
      .where('(application.workerId = :userId OR job.employerId = :userId)', {
        userId,
      })
      .andWhere(
        `(
          application.status IN (:...statuses) 
          OR (application.status = :pendingStatus AND (
            job.isDirectHire = true 
            OR application.coverLetter LIKE :coverLetter 
            OR EXISTS (SELECT 1 FROM application_messages am WHERE am.application_id = application.id)
          ))
        )`,
        {
          statuses: [
            ApplicationStatus.EMPLOYER_ACCEPTED,
            ApplicationStatus.ACCEPTED,
          ],
          pendingStatus: ApplicationStatus.PENDING,
          coverLetter: '%Direct hire request%',
        },
      )
      .orderBy('application.appliedAt', 'DESC')
      .getMany();

    const conversations = await Promise.all(
      applications.map(async (application) => {
        const lastMessage = await this.messageRepository.findOne({
          where: { applicationId: application.id },
          relations: ['sender'],
          order: { createdAt: 'DESC' },
        });

        return {
          applicationId: application.id,
          applicationStatus: application.status,
          jobId: application.jobId,
          jobTitle: application.job?.title ?? 'Công việc',
          isDirectHire: Boolean(
            application.job?.isDirectHire ||
            application.coverLetter?.includes('Direct hire request'),
          ),
          participant:
            application.workerId === userId
              ? application.job?.employer
              : application.worker,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body: lastMessage.body,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
                sender: {
                  id: lastMessage.sender.id,
                  firstName: lastMessage.sender.firstName,
                  lastName: lastMessage.sender.lastName,
                  avatarUrl: lastMessage.sender.avatarUrl,
                },
              }
            : null,
        };
      }),
    );

    return conversations.sort((a, b) => {
      const left = a.lastMessage?.createdAt ?? new Date(0);
      const right = b.lastMessage?.createdAt ?? new Date(0);
      return new Date(right).getTime() - new Date(left).getTime();
    });
  }
}
