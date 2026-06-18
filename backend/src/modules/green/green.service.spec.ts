import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GreenService } from './green.service';
import { GreenChallenge } from './entities/green.entity';
import { Repository } from 'typeorm';

describe('GreenService', () => {
  let service: GreenService;
  let repo: Repository<GreenChallenge>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GreenService,
        {
          provide: getRepositoryToken(GreenChallenge),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GreenService>(GreenService);
    repo = module.get<Repository<GreenChallenge>>(getRepositoryToken(GreenChallenge));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getChallenges', () => {
    it('should return array of green challenges', async () => {
      const mockChallenges = [
        { id: 'challenge-1', title: 'Recycle Paper', type: 'recycle' },
        { id: 'challenge-2', title: 'Plant Trees', type: 'plant' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockChallenges as GreenChallenge[]);

      const result = await service.getChallenges();

      expect(result).toEqual(mockChallenges);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('getChallengeById', () => {
    it('should return challenge when found', async () => {
      const mockChallenge = { id: 'challenge-1', title: 'Recycle Paper', type: 'recycle' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockChallenge as GreenChallenge);

      const result = await service.getChallengeById('challenge-1');

      expect(result).toEqual(mockChallenge);
    });

    it('should throw error when challenge not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getChallengeById('nonexistent')).rejects.toThrow();
    });
  });

  describe('createChallenge', () => {
    it('should create new green challenge', async () => {
      const mockChallenge = { id: 'challenge-1', title: 'New Challenge', type: 'recycle' };
      jest.spyOn(repo, 'create').mockReturnValue(mockChallenge as GreenChallenge);
      jest.spyOn(repo, 'save').mockResolvedValue(mockChallenge as GreenChallenge);

      const result = await service.createChallenge({
        title: 'New Challenge',
        description: 'Challenge description',
        type: 'recycle',
        points_reward: 100,
      });

      expect(result).toEqual(mockChallenge);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
