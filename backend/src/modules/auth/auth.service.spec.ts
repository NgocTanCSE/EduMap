import { AuthService } from './auth.service';
import { NotFoundException } from '@nestjs/common';

describe('AuthService (STT 29)', () => {
  let service: AuthService;
  let userRepo: any;

  beforeEach(() => {
    userRepo = { findOne: jest.fn() };
    service = new AuthService(userRepo, {} as any, {} as any, {} as any);
  });

  describe('getProfile()', () => {
    it('trả về hồ sơ người dùng khi tồn tại', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'nguyen.a@example.com',
        full_name: 'Nguyễn A',
        role: 'student',
        avatar_url: null,
        phone: null,
        bio: null,
        mbti_type: null,
        skills: [],
        interests: [],
        points: 0,
        level: 1,
        status: 'active',
        email_verified: false,
      });

      const result = await service.getProfile('u1');
      expect(result).toMatchObject({
        userId: 'u1',
        email: 'nguyen.a@example.com',
        full_name: 'Nguyễn A',
        role: 'student',
      });
      // không được lộ password_hash / twoFactorSecret
      expect(result).not.toHaveProperty('password_hash');
      expect(result).not.toHaveProperty('twoFactorSecret');
    });

    it('ném NotFoundException khi user không tồn tại', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getProfile('u1')).rejects.toThrow(NotFoundException);
    });
  });
});
