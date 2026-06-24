import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { Repository } from 'typeorm';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let auditLogRepo: Repository<AuditLog>;

  const mockAuditLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    auditLogRepo = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      const mockLog = {
        id: 'log-1',
        action: 'CREATE_USER',
        resource: 'user',
        resource_id: 'user-1',
      };
      jest.spyOn(auditLogRepo, 'create').mockReturnValue(mockLog as any);
      jest.spyOn(auditLogRepo, 'save').mockResolvedValue(mockLog as any);

      const result = await service.log({
        action: 'CREATE_USER',
        resource: 'user',
        resource_id: 'user-1',
      });

      expect(mockAuditLogRepo.create).toHaveBeenCalled();
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return audit logs with pagination', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      jest.spyOn(auditLogRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll({});

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
    });
  });
});