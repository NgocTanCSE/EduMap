import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsLog } from './entities/analytics-log.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsLog)
    private logRepo: Repository<AnalyticsLog>,
  ) {}

  /**
   * 👁️ TRACKING: Ghi lai mot su kien hanh vi
   */
  async logEvent(userId: string, eventType: string, metadata: any) {
    const log = this.logRepo.create({
      user: userId ? { id: userId } as any : null,
      event_type: eventType,
      metadata: metadata,
    });
    return this.logRepo.save(log);
  }

  /**
   * 📈 INSIGHT: Lay top cac tu khoa tim kiem nhieu nhat
   */
  async getTopKeywords() {
    return this.logRepo
      .createQueryBuilder('log')
      .select("log.metadata->>'keyword'", 'keyword')
      .addSelect('COUNT(*)', 'count')
      .where("log.event_type = 'search_keyword'")
      .groupBy('keyword')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();
  }
}
