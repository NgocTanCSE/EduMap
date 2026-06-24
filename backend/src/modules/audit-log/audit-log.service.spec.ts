import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: Repository<AuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    repo = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create and save an audit log entry', async () => {
      const mockLogData = {
        user: { id: '1', email: 'test@test.com' } as User,
        action: 'UPDATE_USER_STATUS',
        resource: 'user',
        resource_id: '1',
        old_data: { status: 'active' },
        new_data: { status: 'inactive' },
      };
      const mockLogEntry = { id: 'log-1', ...mockLogData };
      jest.spyOn(repo, 'create').mockReturnValue(mockLogEntry as AuditLog);
      jest.spyOn(repo, 'save').mockResolvedValue(mockLogEntry as AuditLog);

      const result = await service.log(mockLogData as any);

      expect(repo.create).toHaveBeenCalledWith(mockLogData);
      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual(mockLogEntry);
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        { id: '1', action: 'LOGIN', resource: 'user', created_at: new Date() },
      ] as AuditLog[];
      const qb = repo.createQueryBuilder as jest.Mock;
      const mockGetManyAndCount = jest.fn().mockResolvedValue([mockLogs, 1]);
      qb.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: mockGetManyAndCount,
      });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toEqual(mockLogs);
      expect(result.meta.total).toBe(1);
    });
  });
});
