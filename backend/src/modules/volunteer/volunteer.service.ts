import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolunteerActivity } from './entities/volunteer.entity';

@Injectable()
export class VolunteerService {
  constructor(
    @InjectRepository(VolunteerActivity) private volRepo: Repository<VolunteerActivity>,
  ) {}

  /**
   * Lấy lịch sử tình nguyện của một người dùng
   */
  async getUserActivities(userId: string) {
    const activities = await this.volRepo.find({
      where: { volunteer_id: userId },
      order: { date: 'DESC' },
    });

    const totalHours = activities.reduce((sum, act) => sum + Number(act.hours), 0);

    return {
      activities,
      total_hours: totalHours
    };
  }

  /**
   * Ghi nhận hoạt động tình nguyện
   */
  async logVolunteerActivity(userId: string, data: { title: string; description: string; campaign_name: string; hours: number; date: string }) {
    if (!data.hours || data.hours <= 0) {
        throw new BadRequestException('Số giờ tình nguyện không hợp lệ');
    }

    const activity = this.volRepo.create({
        volunteer_id: userId,
        title: data.title,
        description: data.description,
        campaign_name: data.campaign_name,
        hours: data.hours,
        date: new Date(data.date),
        status: 'pending' // Chờ duyệt
    });

    await this.volRepo.save(activity);

    const { total_hours } = await this.getUserActivities(userId);

    return {
      success: true,
      message: `Đã ghi nhận ${data.hours} giờ. Chờ hệ thống xác thực.`,
      activity,
      current_total: total_hours
    };
  }
}
