import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InternshipService } from './internship.service';
import { Repository } from 'typeorm';
import { Internship } from './entities/internship.entity';
import { InternshipApplication } from './entities/application.entity';

describe('InternshipService', () => {
  let service: InternshipService;
  let internRepo: Repository<Internship>;
  let applicationRepo: Repository<InternshipApplication>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternshipService,
        {
          provide: getRepositoryToken(Internship),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            } as any),
          },
        },
        {
          provide: getRepositoryToken(InternshipApplication),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InternshipService>(InternshipService);
    internRepo = module.get<Repository<Internship>>(getRepositoryToken(Internship));
    applicationRepo = module.get<Repository<InternshipApplication>>(getRepositoryToken(InternshipApplication));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInternship', () => {
    it('should create an internship with location and open status', async () => {
      const mockData = {
        title: 'Frontend Dev Intern',
        description: 'Build cool stuff',
        field: 'Engineering',
        salary_range: '5-8M VND',
        latitude: 10.0,
        longitude: 106.0,
      };
      const savedInternship = {
        id: 'int-1',
        company_id: 'company-1',
        ...mockData,
        location: { type: 'Point', coordinates: [106.0, 10.0] },
        status: 'open',
        created_at: new Date(),
      };
      jest.spyOn(internRepo, 'create').mockReturnValue(savedInternship as Internship);
      jest.spyOn(internRepo, 'save').mockResolvedValue(savedInternship as Internship);

      const result = await service.createInternship('company-1', mockData);

      expect(internRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 'company-1',
          status: 'open',
          location: { type: 'Point', coordinates: [106.0, 10.0] },
        }),
      );
      expect(result.title).toBe('Frontend Dev Intern');
    });

    it('should create internship without location when coords not provided', async () => {
      const mockData = {
        title: 'Marketing Intern',
        description: 'Marketing tasks',
        field: 'Marketing',
      };
      const savedInternship = {
        id: 'int-2',
        company_id: 'company-1',
        ...mockData,
        location: null,
        status: 'open',
        created_at: new Date(),
      };
      jest.spyOn(internRepo, 'create').mockReturnValue(savedInternship as Internship);
      jest.spyOn(internRepo, 'save').mockResolvedValue(savedInternship as Internship);

      const result = await service.createInternship('company-1', mockData);

      expect(result.location).toBeNull();
    });
  });

  describe('getInternships', () => {
    it('should return paginated internship list with meta', async () => {
      const mockInternships = [
        { id: 'int-1', title: 'Intern A', company: { id: 'c-1' } },
        { id: 'int-2', title: 'Intern B', company: { id: 'c-2' } },
      ];
      jest.spyOn(internRepo, 'findAndCount').mockResolvedValue([mockInternships as Internship[], 50]);

      const result = await service.getInternships(1, 10);

      expect(result.items).toHaveLength(2);
      expect(result.meta.totalItems).toBe(50);
      expect(result.meta.itemCount).toBe(2);
      expect(result.meta.currentPage).toBe(1);
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.itemsPerPage).toBe(10);
    });
  });

  describe('getInternshipById', () => {
    it('should return internship by id', async () => {
      const mockInternship = {
        id: 'int-1',
        title: 'Intern A',
        description: 'Desc',
        field: 'Tech',
        company: { id: 'c-1' },
        status: 'open',
      };
      jest.spyOn(internRepo, 'findOne').mockResolvedValue(mockInternship as Internship);

      const result = await service.getInternshipById('int-1');

      expect(result).toEqual(mockInternship);
      expect(internRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'int-1' },
        relations: ['company'],
      });
    });

    it('should throw NotFoundException when internship not found', async () => {
      jest.spyOn(internRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getInternshipById('invalid-id')).rejects.toThrow(
        'Không tìm thấy cơ hội thực tập này',
      );
    });
  });

  describe('getInternshipsNearby', () => {
    it('should call query builder for nearby internships', async () => {
      jest.spyOn(internRepo, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'int-1', title: 'Nearby', location: { type: 'Point', coordinates: [106, 10] } },
        ]),
      } as any);

      const result = await service.getInternshipsNearby(10.0, 106.0, 5000);

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(internRepo.createQueryBuilder).toHaveBeenCalledWith('internship');
    });
  });

  describe('applyInternship', () => {
    it('should submit application when internship is open and not yet applied', async () => {
      const mockInternship = {
        id: 'int-1',
        status: 'open',
        title: 'Intern A',
      };
      jest.spyOn(internRepo, 'findOne').mockResolvedValue(mockInternship as Internship);
      jest.spyOn(applicationRepo, 'findOne').mockResolvedValue(null);

      const mockApplication = {
        id: 'app-1',
        user_id: 'user-1',
        internship_id: 'int-1',
        cover_letter: 'CV attached',
        status: 'reviewing',
        tracking_id: 'INT-APPLY-int-1-user-1-123',
      };
      jest.spyOn(applicationRepo, 'create').mockReturnValue(mockApplication as InternshipApplication);
      jest.spyOn(applicationRepo, 'save').mockResolvedValue(mockApplication as InternshipApplication);

      const result = await service.applyInternship('user-1', 'int-1', 'CV attached');

      expect(applicationRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('reviewing');
      expect(result.success).toBe(true);
      expect(result.tracking_id).toBeDefined();
    });

    it('should throw NotFoundException when internship not found', async () => {
      jest.spyOn(internRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.applyInternship('user-1', 'invalid-int', 'CV'),
      ).rejects.toThrow('Không tìm thấy cơ hội thực tập này');
    });

    it('should throw BadRequestException when internship is closed', async () => {
      jest.spyOn(internRepo, 'findOne').mockResolvedValue({ id: 'int-1', status: 'closed' } as Internship);

      await expect(
        service.applyInternship('user-1', 'int-1', 'CV'),
      ).rejects.toThrow('Vị trí thực tập này đã đóng đăng ký.');
    });

    it('should throw BadRequestException when already applied', async () => {
      jest.spyOn(internRepo, 'findOne').mockResolvedValue({ id: 'int-1', status: 'open' } as Internship);
      jest.spyOn(applicationRepo, 'findOne').mockResolvedValue({ id: 'existing-app' } as InternshipApplication);

      await expect(
        service.applyInternship('user-1', 'int-1', 'CV'),
      ).rejects.toThrow('Bạn đã nộp đơn ứng tuyển cho vị trí này rồi');
    });
  });
});
