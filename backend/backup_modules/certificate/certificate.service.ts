import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from './entities/certificate.entity';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(Certificate) private certRepo: Repository<Certificate>,
  ) {}

  // 1. Kh?i t?o ch?ng nh?n (Generate Cert)
  async generateCertificate(userId: string, title: string, type: string, issuer: string) {
    const certCode = 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const cert = this.certRepo.create({
      user_id: userId,
      title,
      type,
      issuer,
      verify_code: certCode,
      issued_at: new Date(),
      // Th?c t? có th? tích h?p thý vi?n PDF ð? sinh file và lýu S3, tr? v? pdf_url
      pdf_url: https://edumap.app/certs/\.pdf 
    });

    return this.certRepo.save(cert);
  }

  // 2. Xác th?c ch?ng nh?n ði?n t? (Verify)
  async verifyCertificate(code: string) {
    const cert = await this.certRepo.findOne({ where: { verify_code: code } });
    if (!cert) return { isValid: false, message: 'Ch?ng ch? không t?n t?i ho?c m? xác th?c sai.' };
    
    return { 
      isValid: true, 
      details: {
        title: cert.title,
        issuer: cert.issuer,
        issued_at: cert.issued_at
      }
    };
  }

  // 3. H? sõ nãng l?c cá nhân (Portfolio)
  async getUserPortfolio(userId: string) {
    const certs = await this.certRepo.find({ where: { user_id: userId }, order: { issued_at: 'DESC' } });
    return {
      total_certs: certs.length,
      portfolio_link: https://edumap.app/portfolio/\,
      certificates: certs
    };
  }
}

