import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from './entities/certificate.entity';
import * as crypto from 'crypto';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(Certificate) private readonly certRepo: Repository<Certificate>,
  ) {}

  /**
   * Cấp chứng nhận số mới (Simulated Blockchain anchor)
   */
  async generateCertificate(userId: string, title: string, type: string, issuer: string) {
    const certCode = 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Tạo hash blockchain mô phỏng lưu trên sổ cái
    const txHash = crypto.createHash('sha256').update(`${userId}-${title}-${certCode}`).digest('hex');

    const cert = this.certRepo.create({
      user_id: userId,
      title,
      type,
      issuer,
      verify_code: certCode,
      issued_at: new Date(),
      pdf_url: `https://edumap.app/certs/${certCode}.pdf`,
      qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://edumap.app/verify/${certCode}`,
      blockchain_metadata: {
        network: 'EduMap Ledger Mainnet',
        block_height: Math.floor(Math.random() * 1000000) + 5000000,
        tx_hash: `0x${txHash}`,
        status: 'CONFIRMED',
      },
    });

    return this.certRepo.save(cert);
  }

  /**
   * Xác thực chứng chỉ số (Verify)
   */
  async verifyCertificate(code: string) {
    const cert = await this.certRepo.findOne({
      where: { verify_code: code },
      relations: ['user'],
    });

    if (!cert) {
      return {
        isValid: false,
        message: 'Chứng nhận không tồn tại hoặc mã xác thực không chính xác.',
      };
    }

    return {
      isValid: true,
      message: 'Chứng nhận điện tử hợp lệ!',
      details: {
        title: cert.title,
        type: cert.type,
        issuer: cert.issuer,
        issued_at: cert.issued_at,
        verify_code: cert.verify_code,
        recipient: cert.user ? { name: cert.user.full_name, email: cert.user.email } : null,
        blockchain: cert.blockchain_metadata,
      },
    };
  }

  /**
   * Lấy hồ sơ năng lực cá nhân (Portfolio)
   */
  async getUserPortfolio(userId: string) {
    const certs = await this.certRepo.find({
      where: { user_id: userId },
      order: { issued_at: 'DESC' },
    });

    return {
      total_certs: certs.length,
      portfolio_link: `https://edumap.app/portfolio/${userId}`,
      certificates: certs,
    };
  }
}
