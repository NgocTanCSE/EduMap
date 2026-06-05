import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCertificate, CertificateStatus } from './entities/user-certificate.entity';
import { CertificateTemplate } from './entities/certificate-template.entity';
import * as crypto from 'crypto';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(UserCertificate) private readonly certRepo: Repository<UserCertificate>,
    @InjectRepository(CertificateTemplate) private readonly templateRepo: Repository<CertificateTemplate>,
  ) {}

  /**
   * Cấp chứng nhận số mới (Simulated Blockchain anchor)
   * Đã sửa: Chỉ cấp dựa trên Template ID có sẵn.
   */
  async issueCertificate(userId: string, templateId: string) {
    const template = await this.templateRepo.findOne({ 
        where: { id: templateId },
        relations: ['organization'] 
    });

    if (!template) {
        throw new NotFoundException('Template chứng chỉ không tồn tại');
    }

    // Check if user already has this certificate
    const existingCert = await this.certRepo.findOne({
        where: { user_id: userId, template_id: templateId }
    });

    if (existingCert) {
        throw new BadRequestException('Người dùng đã sở hữu chứng chỉ này');
    }

    const certCode = 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Tạo hash blockchain mô phỏng lưu trên sổ cái
    const txHash = crypto.createHash('sha256').update(`${userId}-${template.name}-${certCode}`).digest('hex');

    const cert = this.certRepo.create({
      user_id: userId,
      template_id: templateId,
      verify_code: certCode,
      issued_at: new Date(),
      status: CertificateStatus.ACTIVE,
      // Trong thực tế, PDF/QR nên được generate và lưu lên S3
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
   * Thu hồi chứng chỉ
   */
  async revokeCertificate(certId: string) {
      const cert = await this.certRepo.findOne({ where: { id: certId } });
      if (!cert) throw new NotFoundException('Chứng chỉ không tồn tại');

      cert.status = CertificateStatus.REVOKED;
      return this.certRepo.save(cert);
  }

  /**
   * Xác thực chứng chỉ số (Verify)
   */
  async verifyCertificate(code: string) {
    const cert = await this.certRepo.findOne({
      where: { verify_code: code },
      relations: ['user', 'template', 'template.organization'],
    });

    if (!cert) {
      return {
        isValid: false,
        message: 'Chứng nhận không tồn tại hoặc mã xác thực không chính xác.',
      };
    }

    if (cert.status === CertificateStatus.REVOKED) {
        return {
            isValid: false,
            message: 'Chứng chỉ này đã bị thu hồi.',
            details: { revoked_at: (cert as any).updated_at }
        };
    }

    return {
      isValid: true,
      message: 'Chứng nhận điện tử hợp lệ!',
      details: {
        title: cert.template?.name,
        type: cert.template?.type,
        issuer: cert.template?.organization?.name,
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
      where: { user_id: userId, status: CertificateStatus.ACTIVE },
      relations: ['template', 'template.organization'],
      order: { issued_at: 'DESC' },
    });

    return {
      total_certs: certs.length,
      portfolio_link: `https://edumap.app/portfolio/${userId}`,
      certificates: certs,
    };
  }
}
