import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class MfaService {
  /**
   * 🔐 Tao ma bi mat va ma QR cho Admin lan dau thiet lap 2FA
   */
  async generateSecret(userEmail: string) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userEmail, 'EduMap Admin', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
    
    return { secret, qrCodeUrl };
  }

  /**
   * 🛡️ Xac thuc ma 6 chu so tu dien thoai
   */
  verifyToken(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }
}
