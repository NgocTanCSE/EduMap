import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GreenChallengeActivity, GreenChallenge } from './entities/green.entity';

@Injectable()
export class GreenCampusService {
  constructor(
    @InjectRepository(GreenChallengeActivity) private activityRepo: Repository<GreenChallengeActivity>,
    @InjectRepository(GreenChallenge) private challengeRepo: Repository<GreenChallenge>,
  ) { }

  async getChallenges() {
    return this.challengeRepo.find({ where: { status: 'active' } });
  }

  /**
   * F-17: Challenge Sống xanh (Tham gia & Nộp báo cáo)
   */
  async joinChallenge(userId: string, challengeId: string) {
    return { success: true, message: 'Đã tham gia thử thách sống xanh!' };
  }

  async logActivity(userId: string, data: any) {
    const activity = this.activityRepo.create({ ...data, user_id: userId, carbon_saved_kg: 0.5 });
    return this.activityRepo.save(activity);
  }
}
