import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEvent } from './entities/user-event.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(UserEvent)
    private userEventRepo: Repository<UserEvent>,
  ) {}

  async trackEvent(userId: string, eventType: string, metadata: any) {
    const event = this.userEventRepo.create({
      userId,
      eventType,
      metadata,
    });
    return await this.userEventRepo.save(event);
  }

  async getGlobalStats() {
    const totalEvents = await this.userEventRepo.count();
    const eventTypes = await this.userEventRepo
      .createQueryBuilder('event')
      .select('event.event_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.event_type')
      .getRawMany();

    return {
      total_events: totalEvents,
      breakdown: eventTypes,
    };
  }
}
