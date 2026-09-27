import { authenticator } from 'otplib';
import { MfaService } from './mfa.service';

jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn(),
    keyuri: jest.fn(),
    verify: jest.fn(),
  },
}));

describe('MfaService (STT 29)', () => {
  let service: MfaService;
  let userRepo: any;

  beforeEach(() => {
    userRepo = { findOne: jest.fn() };
    service = new MfaService(userRepo);
    jest.clearAllMocks();
  });

  describe('verifyTwoFactor()', () => {
    it('ném NotFoundException khi user không tồn tại', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyTwoFactor('u1', '123456')).rejects.toThrow(/không tồn tại/);
    });

    it('ném UnauthorizedException khi chưa bật 2FA', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', isTwoFactorEnabled: false, twoFactorSecret: null });
      await expect(service.verifyTwoFactor('u1', '123456')).rejects.toThrow(/chưa bật/);
    });

    it('trả về true khi token TOTP hợp lệ', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', isTwoFactorEnabled: true, twoFactorSecret: 'BASE32SECRET' });
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      await expect(service.verifyTwoFactor('u1', '123456')).resolves.toBe(true);
      expect(authenticator.verify).toHaveBeenCalledWith({ token: '123456', secret: 'BASE32SECRET' });
    });

    it('trả về false khi token không hợp lệ', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', isTwoFactorEnabled: true, twoFactorSecret: 'BASE32SECRET' });
      (authenticator.verify as jest.Mock).mockReturnValue(false);
      await expect(service.verifyTwoFactor('u1', '999999')).resolves.toBe(false);
    });
  });
});
