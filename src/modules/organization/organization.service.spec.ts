import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job, JobApplication } from '../job/entities';
import { PaymentConfirmation, Escrow } from '../payment/entities';

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: getRepositoryToken(Job),
          useValue: {},
        },
        {
          provide: getRepositoryToken(JobApplication),
          useValue: {},
        },
        {
          provide: getRepositoryToken(PaymentConfirmation),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Escrow),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
