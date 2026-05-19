import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfile } from './entities/business.entity';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(BusinessProfile) private bizRepo: Repository<BusinessProfile>,
  ) {}

  // 1. H? sõ doanh nghi?p & Gói tài tr? (Company Profile & Sponsorship)
  async getCompanyProfile(companyId: string) {
    const profile = await this.bizRepo.findOne({ where: { id: companyId } });
    if (!profile) throw new NotFoundException('Doanh nghi?p không t?n t?i');
    
    return {
      profile,
      active_sponsorships: ['Tài tr? gi?i Hackathon mùa Thu', 'Tài tr? thý vi?n máy tính'],
      rating: 4.8
    };
  }

  // 2. Ðãng tuy?n th?c t?p (Internship Posting)
  async postInternship(companyId: string, jobDetails: any) {
    // Logic: Lýu vào b?ng Internship (MOD-19)
    return { success: true, message: 'Ð? ðãng tuy?n d?ng th?c t?p lên Internship Map.', job_id: 'INT-999' };
  }
}

