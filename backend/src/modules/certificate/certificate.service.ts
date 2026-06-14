import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCertificate, CertificateStatus } from './entities/user-certificate.entity';
import { CertificateTemplate } from './entities/certificate-template.entity';
import * as crypto from 'crypto';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { PassThrough } from 'stream';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(UserCertificate) private readonly certRepo: Repository<UserCertificate>,
    @InjectRepository(CertificateTemplate) private readonly templateRepo: Repository<CertificateTemplate>,
  ) {}

  async issueCertificate(userId: string, templateId: string) {
    const template = await this.templateRepo.findOne({ 
        where: { id: templateId },
        relations: ['organization'] 
    });

    if (!template) throw new NotFoundException('Template không tồn tại');

    const existingCert = await this.certRepo.findOne({
        where: { user_id: userId, template_id: templateId }
    });

    if (existingCert) throw new BadRequestException('Người dùng đã sở hữu chứng chỉ này');

    const certCode = 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const txHash = crypto.createHash('sha256').update(`${userId}-${template.name}-${certCode}`).digest('hex');

    const cert = this.certRepo.create({
      user_id: userId,
      template_id: templateId,
      verify_code: certCode,
      issued_at: new Date(),
      status: CertificateStatus.ACTIVE,
      pdf_url: `/api/certificates/download/${certCode}.pdf`,
      qr_url: `/api/certificates/verify-qr/${certCode}`,
      blockchain_metadata: {
        network: 'EduMap Blockchain',
        tx_hash: `0x${txHash}`,
        status: 'CONFIRMED',
      },
    });

    return this.certRepo.save(cert);
  }

  /**
   * Tạo tệp tin PDF chứng nhận thực tế
   */
  async generateCertificatePdf(code: string): Promise<Buffer> {
    const cert = await this.certRepo.findOne({
      where: { verify_code: code },
      relations: ['user', 'template', 'template.organization'],
    });

    if (!cert) throw new NotFoundException('Chứng chỉ không tồn tại');

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const buffers: any[] = [];
    doc.on('data', buffers.push.bind(buffers));
    
    return new Promise(async (resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Vẽ chứng chỉ
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(5).stroke('#eab308');
      
      doc.fontSize(40).fillColor('#18181b').text('CHỨNG NHẬN HOÀN THÀNH', 0, 100, { align: 'center' });
      
      doc.fontSize(20).text('Hệ thống Bản đồ Giáo dục EduMap Biên Hòa trân trọng trao tặng cho:', 0, 180, { align: 'center' });
      
      doc.fontSize(35).fillColor('#eab308').text(cert.user?.full_name || 'Học viên EduMap', 0, 230, { align: 'center' });
      
      doc.fontSize(20).fillColor('#18181b').text(`Vì đã hoàn thành xuất sắc:`, 0, 300, { align: 'center' });
      doc.fontSize(25).font('Helvetica-Bold').text(cert.template?.name || 'Khóa học cộng đồng', 0, 340, { align: 'center' });

      doc.fontSize(12).font('Helvetica').text(`Mã xác thực: ${cert.verify_code}`, 50, 500);
      doc.text(`Ngày cấp: ${cert.issued_at.toLocaleDateString('vi-VN')}`, 50, 520);
      
      // Chèn mã QR
      const qrData = `https://edumap.vn/verify/${cert.verify_code}`;
      const qrBuffer = await QRCode.toBuffer(qrData);
      doc.image(qrBuffer, doc.page.width - 150, 430, { width: 100 });
      doc.fontSize(8).text('Quét để xác thực', doc.page.width - 150, 535, { width: 100, align: 'center' });

      doc.end();
    });
  }

  async verifyCertificate(code: string) {
    const cert = await this.certRepo.findOne({
      where: { verify_code: code },
      relations: ['user', 'template', 'template.organization'],
    });

    if (!cert) return { isValid: false, message: 'Mã xác thực không chính xác.' };

    return {
      isValid: true,
      message: 'Chứng nhận hợp lệ!',
      details: {
        title: cert.template?.name,
        recipient: cert.user?.full_name,
        issued_at: cert.issued_at,
        blockchain: cert.blockchain_metadata,
      },
    };
  }

  async getUserPortfolio(userId: string) {
    const certs = await this.certRepo.find({
      where: { user_id: userId, status: CertificateStatus.ACTIVE },
      relations: ['template', 'template.organization'],
      order: { issued_at: 'DESC' },
    });

    return {
      total: certs.length,
      certificates: certs,
    };
  }
}
