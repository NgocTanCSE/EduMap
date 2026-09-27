import { GamificationService } from './gamification.service';

describe('GamificationService (STT 25)', () => {
  let service: GamificationService;
  let badgeRepo: any;
  let userBadgeRepo: any;
  let userPointRepo: any;
  let greenActivityRepo: any;
  let userRepo: any;

  beforeEach(() => {
    badgeRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    userBadgeRepo = { find: jest.fn() };
    userPointRepo = { createQueryBuilder: jest.fn() };
    greenActivityRepo = { create: jest.fn(), save: jest.fn() };
    userRepo = {};
    service = new GamificationService(badgeRepo, userBadgeRepo, userPointRepo, greenActivityRepo, userRepo);
  });

  describe('getUserBadges()', () => {
    it('trả về danh sách badge đã ánh xạ', async () => {
      userBadgeRepo.find.mockResolvedValue([
        {
          id: 'ub1',
          badge_id: 1,
          badge: { id: 1, name: 'Eco Hero', category: 'green', rarity: 'rare' },
          earned_at: new Date(),
        },
      ]);

      const result = await service.getUserBadges('u1');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'ub1',
        badge_id: 1,
        name: 'Eco Hero',
        category: 'green',
        rarity: 'rare',
      });
    });

    it('trả về mảng rỗng khi lỗi', async () => {
      userBadgeRepo.find.mockRejectedValue(new Error('db down'));
      await expect(service.getUserBadges('u1')).resolves.toEqual([]);
    });
  });
});
