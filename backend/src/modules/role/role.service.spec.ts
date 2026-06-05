import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoleService } from './role.service';
import { Role } from './role.entity';
import { Repository } from 'typeorm';

describe('RoleService', () => {
  let service: RoleService;
  let repo: Repository<Role>;

  const mockRoleRepository = {
    find: jest.fn().mockResolvedValue([
      { id: 1, name: 'Admin', description: 'Administrator' },
      { id: 2, name: 'User', description: 'Regular User' },
    ]),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    repo = module.get<Repository<Role>>(getRepositoryToken(Role));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of roles', async () => {
      const result = await service.findAll();
      expect(result).toEqual([
        { id: 1, name: 'Admin', description: 'Administrator' },
        { id: 2, name: 'User', description: 'Regular User' },
      ]);
      expect(repo.find).toHaveBeenCalled();
    });
  });
});
