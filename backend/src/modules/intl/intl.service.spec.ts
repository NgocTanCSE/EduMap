import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IntlService } from './intl.service';
import { Repository } from 'typeorm';
import { InternationalProgram, AlumniNetwork } from './entities/intl.entity';

describe('IntlService', () => {
  let service: IntlService;
  let intlRepository: Repository<InternationalProgram>;
  let alumniRepository: Repository<AlumniNetwork>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntlService,
        {
          provide: getRepositoryToken(InternationalProgram),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AlumniNetwork),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            } as any),
          },
        },
      ],
    }).compile();

    service = module.get<IntlService>(IntlService);
    intlRepository = module.get<Repository<InternationalProgram>>(getRepositoryToken(InternationalProgram));
    alumniRepository = module.get<Repository<AlumniNetwork>>(getRepositoryToken(AlumniNetwork));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all programs ordered by created_at DESC', async () => {
      const mockPrograms = [
        { id: 'p-1', title: 'Exchange MIT', type: 'exchange', created_at: new Date() },
        { id: 'p-2', title: 'Scholarship', type: 'scholarship', created_at: new Date() },
      ];
      jest.spyOn(intlRepository, 'find').mockResolvedValue(mockPrograms as InternationalProgram[]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(intlRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { created_at: 'DESC' } }),
      );
    });

    it('should filter programs by type when provided', async () => {
      jest.spyOn(intlRepository, 'find').mockResolvedValue([]);

      await service.findAll('exchange');

      expect(intlRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'exchange' } }),
      );
    });
  });

  describe('createProgram', () => {
    it('should create and save a new international program', async () => {
      const mockData = {
        title: 'New Exchange',
        type: 'exchange',
        description: 'An exchange program',
        host_country: 'USA',
        organization: 'UniABC',
      };
      const saved = { id: 'p-3', ...mockData, created_at: new Date() };
      jest.spyOn(intlRepository, 'create').mockReturnValue(saved as InternationalProgram);
      jest.spyOn(intlRepository, 'save').mockResolvedValue(saved as InternationalProgram);

      const result = await service.createProgram(mockData);

      expect(intlRepository.create).toHaveBeenCalledWith(mockData);
      expect(result).toEqual(saved);
    });
  });

  describe('registerAlumni', () => {
    it('should create alumni with valid data and default status', async () => {
      const data = {
        full_name: 'Nguyen Van A',
        university: 'MIT',
        country: 'USA',
        major: 'CS',
        latitude: 42.36,
        longitude: -71.06,
      };
      const savedAlumni = {
        id: 'al-1',
        ...data,
        country: 'USA',
        major: 'CS',
        status: 'studying',
        created_at: new Date(),
      };
      jest.spyOn(alumniRepository, 'create').mockReturnValue(savedAlumni as AlumniNetwork);
      jest.spyOn(alumniRepository, 'save').mockResolvedValue(savedAlumni as AlumniNetwork);

      const result = await service.registerAlumni(data);

      expect(alumniRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Nguyen Van A',
          university: 'MIT',
          status: 'studying',
        }),
      );
      expect(result.status).toBe('studying');
    });

    it('should throw BadRequestException when required fields missing', async () => {
      await expect(
        service.registerAlumni({ full_name: 'A' }),
      ).rejects.toThrow('Vui lòng điền đầy đủ họ tên, trường đại học, kinh độ và vĩ độ');
    });
  });

  describe('getAllAlumni', () => {
    it('should return all alumni ordered by created_at DESC', async () => {
      const mockAlumni = [
        { id: 'al-1', full_name: 'Alumni A', university: 'MIT' },
        { id: 'al-2', full_name: 'Alumni B', university: 'Stanford' },
      ];
      jest.spyOn(alumniRepository, 'find').mockResolvedValue(mockAlumni as AlumniNetwork[]);

      const result = await service.getAllAlumni();

      expect(result).toHaveLength(2);
      expect(alumniRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { created_at: 'DESC' } }),
      );
    });
  });

  describe('getAlumniNearby', () => {
    it('should call query builder to find nearby alumni by postcode', async () => {
      jest.spyOn(alumniRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'al-1', full_name: 'Nearby Alumni', location: { type: 'Point', coordinates: [-71.06, 42.36] } },
        ]),
      } as any);

      const result = await service.getAlumniNearby(42.36, -71.06, 10000);

      expect(result).toHaveLength(1);
      expect(result[0].full_name).toBe('Nearby Alumni');
    });
  });
});
