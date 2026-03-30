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
import { ApplicationStatus, AssignmentStatus } from '../../common/enums';
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
    if (application.status !== ApplicationStatus.ACCEPTED) return false;
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
    if (application.status !== ApplicationStatus.ACCEPTED) {
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
}
