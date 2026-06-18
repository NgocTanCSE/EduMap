import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HackathonService } from './hackathon.service';
import { Hackathon } from './entities/hackathon.entity';
import { Repository } from 'typeorm';

describe('HackathonService', () => {
  let service: HackathonService;
  let repo: Repository<Hackathon>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HackathonService,
        {
          provide: getRepositoryToken(Hackathon),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HackathonService>(HackathonService);
    repo = module.get<Repository<Hackathon>>(getRepositoryToken(Hackathon));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHackathons', () => {
    it('should return array of hackathons', async () => {
      const mockHackathons = [
        { id: 'hack-1', title: 'AI Hackathon 2026', status: 'upcoming' },
        { id: 'hack-2', title: 'Green Tech Challenge', status: 'ongoing' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockHackathons as Hackathon[]);

      const result = await service.getHackathons();

      expect(result).toEqual(mockHackathons);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('getHackathonById', () => {
    it('should return hackathon when found', async () => {
      const mockHack = { id: 'hack-1', title: 'AI Hackathon 2026', status: 'upcoming' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockHack as Hackathon);

      const result = await service.getHackathonById('hack-1');

      expect(result).toEqual(mockHack);
    });

    it('should throw error when hackathon not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getHackathonById('nonexistent')).rejects.toThrow();
    });
  });

  describe('registerTeam', () => {
    it('should register team for hackathon', async () => {
      const mockTeam = { id: 'team-1', team_name: 'AI Innovators', hackathon_id: 'hack-1' };
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 'hack-1', title: 'AI Hackathon' } as Hackathon);
      jest.spyOn(repo, 'save').mockResolvedValue({ id: 'hack-1', teams: [mockTeam] } as any);

      const result = await service.registerTeam('hack-1', {
        team_name: 'AI Innovators',
        member_ids: ['user-1', 'user-2'],
      });

      expect(result).toBeDefined();
    });
  });
});
