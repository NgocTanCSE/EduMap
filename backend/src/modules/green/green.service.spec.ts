import { GreenService } from './green.service';

describe('GreenService (STT 24)', () => {
  let service: GreenService;
  let challengeRepo: any;
  let activityRepo: any;

  beforeEach(() => {
    challengeRepo = { find: jest.fn() };
    activityRepo = { create: jest.fn(), save: jest.fn(), count: jest.fn() };
    service = new GreenService(challengeRepo, activityRepo);
  });

  describe('getChallenges()', () => {
    it('ánh xạ thử thách kèm số người tham gia', async () => {
      const now = new Date();
      challengeRepo.find.mockResolvedValue([
        { id: 'c1', title: 'Tái chất thải', description: 'Recycling', points_reward: 10, status: 'active', created_at: now },
      ]);
      activityRepo.count.mockResolvedValue(3);

      const result = await service.getChallenges();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'c1',
        title: 'Tái chất thải',
        points: 10,
        participants_count: 3,
        carbon_saved_kg: 5,
      });
    });

    it('trả về mảng rỗng khi lỗi', async () => {
      challengeRepo.find.mockRejectedValue(new Error('db down'));
      await expect(service.getChallenges()).resolves.toEqual([]);
    });
  });

  describe('logActivity()', () => {
    it('tạo bản ghi hoạt động và trả về', async () => {
      const fakeActivity = {
        id: 'a1',
        user_id: 'u1',
        challenge_id: 'c1',
        carbon_saved_kg: 4,
        points_earned: 8,
        created_at: new Date(),
      };
      activityRepo.create.mockReturnValue(fakeActivity);
      activityRepo.save.mockResolvedValue(fakeActivity);

      const result = await service.logActivity('u1', 'c1', 4);
      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u1', challenge_id: 'c1', carbon_saved_kg: 4, points_earned: 8 }),
      );
      expect(activityRepo.save).toHaveBeenCalledWith(fakeActivity);
      expect(result).toEqual(expect.objectContaining({ id: 'a1', points_earned: 8 }));
    });
  });
});
