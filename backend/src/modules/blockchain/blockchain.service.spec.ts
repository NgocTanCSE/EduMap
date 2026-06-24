import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Certificate } from '../certificate/entities/certificate-template.entity';
import { Repository } from 'typeorm';

describe('BlockchainService', () => {
  let service: BlockchainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        {
          provide: getRepositoryToken(Certificate),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyCertificate', () => {
    it('should verify certificate on blockchain', async () => {
      const result = await service.verifyCertificate('cert-1');

      expect(result).toHaveProperty('success');
    });
  });

  describe('issueCertificate', () => {
    it('should issue certificate on blockchain', async () => {
      const result = await service.issueCertificate({ userId: 'user-1', certificateData: {} });

      expect(result).toHaveProperty('success');
    });
  });
});