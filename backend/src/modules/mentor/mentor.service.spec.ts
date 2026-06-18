import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MentorService } from './mentor.service';
import { Mentor } from './entities/mentor.entity';
import { Repository } from 'typeorm';

describe('MentorService', () => {
  let service: MentorService;
  let repo: Repository<Mentor>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorService,
        {
          provide: getRepositoryToken(Mentor),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MentorService>(MentorService);
    repo = module.get<Repository<Mentor>>(getRepositoryToken(Mentor));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMentors', () => {
    it('should return array of mentors', async () => {
      const mockMentors = [
        { user_id: 'mentor-1', bio: 'Senior Developer', is_verified: true },
        { user_id: 'mentor-2', bio: 'Product Manager', is_verified: true },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockMentors as Mentor[]);

      const result = await service.getMentors();

      expect(result).toEqual(mockMentors);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('getMentorById', () => {
    it('should return mentor when found', async () => {
      const mockMentor = { user_id: 'mentor-1', bio: 'Senior Developer', is_verified: true };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockMentor as Mentor);

      const result = await service.getMentorById('mentor-1');

      expect(result).toEqual(mockMentor);
    });

    it('should throw error when mentor not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getMentorById('nonexistent')).rejects.toThrow();
    });
  });

  describe('registerMentor', () => {
    it('should register new mentor', async () => {
      const mockMentor = { user_id: 'user-1', bio: 'New Mentor', is_verified: false };
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      jest.spyOn(repo, 'create').mockReturnValue(mockMentor as Mentor);
      jest.spyOn(repo, 'save').mockResolvedValue(mockMentor as Mentor);

      const result = await service.registerMentor('user-1', {
        bio: 'New Mentor',
        specialties: ['JavaScript', 'React'],
      });

      expect(result).toEqual(mockMentor);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
