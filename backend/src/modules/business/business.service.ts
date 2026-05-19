import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfile } from './entities/business.entity';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(BusinessProfile) private readonly bizRepo: Repository<BusinessProfile>,
  ) {}

  /**
   * Tạo mới hoặc cập nhật hồ sơ doanh nghiệp (MOD-11)
   */
  async createOrUpdateProfile(userId: string, data: any) {
    let profile = await this.bizRepo.findOne({ where: { user_id: userId } });

    if (profile) {
      // Cập nhật
      profile.name = data.name || profile.name;
      profile.description = data.description || profile.description;
      profile.industry = data.industry || profile.industry;
      profile.website = data.website || profile.website;
      profile.logo_url = data.logo_url || profile.logo_url;
      return this.bizRepo.save(profile);
    } else {
      // Tạo mới
      const newProfile = this.bizRepo.create({
        ...data,
        user_id: userId,
        is_verified: false,
      });
      return this.bizRepo.save(newProfile);
    }
  }

  /**
   * F-11: Lấy chi tiết hồ sơ doanh nghiệp & các gói tài trợ
   */
  async getCompanyProfile(companyId: string) {
    const profile = await this.bizRepo.findOne({ where: { id: companyId } });
    if (!profile) throw new NotFoundException('Doanh nghiệp không tồn tại');

    return {
      profile,
      active_sponsorships: [
        'Nhà tài trợ vàng cuộc thi EduMap Hackathon 2026',
        'Tài trợ thiết bị tin học phòng Lab trường THPT Chuyên',
        'Tài trợ 20 suất học bổng xanh Green Campus'
      ],
      rating: 4.9,
    };
  }

  /**
   * Lấy danh sách tất cả các doanh nghiệp kết nối
   */
  async getAllProfiles() {
    return this.bizRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Xác minh hồ sơ doanh nghiệp (Dành cho Admin)
   */
  async verifyProfile(companyId: string) {
    const profile = await this.bizRepo.findOne({ where: { id: companyId } });
    if (!profile) throw new NotFoundException('Doanh nghiệp không tồn tại');

    profile.is_verified = true;
    return this.bizRepo.save(profile);
  }
}
