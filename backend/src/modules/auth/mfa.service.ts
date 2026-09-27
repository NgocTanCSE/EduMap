import { Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { User } from './entities/user.entity';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 🔐 Tạo mật khẩu bí mật và mã QR cho Admin lần đầu thiết lập 2FA
   */
  async generateSecret(userEmail: string) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userEmail, 'EduMap Admin', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
    
    return { secret, qrCodeUrl };
  }

  /**
   * 🛡️ Xác thực mã 6 chữ số từ điện thoại (TOTP) của người dùng.
   * Ánh xạ theo bảng 6.2 — STT 29: mfa.service.ts ↳ verifyTwoFactor()
   */
  async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'isTwoFactorEnabled', 'twoFactorSecret'],
    });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }
    if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Tài khoản chưa bật xác thực hai yếu tố.');
    }
    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid) {
      this.logger.warn(`Invalid 2FA token attempt for user ${userId}`);
    }
    return isValid;
  }

  /**
   * 🛡️ Xác thực mã 6 chữ số (legacy helper)
   */
  verifyToken(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }
}
