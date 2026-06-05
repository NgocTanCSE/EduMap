import { GamificationService } from '../gamification/gamification.service';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventRegistration } from './entities/event.entity';
import * as QRCode from 'qrcode';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly dataSource: DataSource,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(EventRegistration)
    private readonly registrationRepository: Repository<EventRegistration>,
  ) {}

  /**
   * F-12: Tạo workshop/sự kiện mới
   */
  async createEvent(organizerId: string, data: any) {
    const event = this.eventRepository.create({
      ...data,
      organizer_id: organizerId,
      registered_count: 0,
    });
    return this.eventRepository.save(event);
  }

  /**
   * F-12: Cập nhật thông tin sự kiện
   */
  async updateEvent(id: string, data: any) {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện');

    Object.assign(event, data);
    return this.eventRepository.save(event);
  }

  /**
   * Lấy danh sách sự kiện
   */
  async getEvents() {
    return this.eventRepository.find({ order: { start_date: 'ASC' } });
  }

  /**
   * Lấy chi tiết sự kiện
   */
  async getEventById(id: string) {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện');
    return event;
  }

  /**
   * F-13: Đăng ký tham gia workshop/sự kiện (Tạo ticket & QR Code) - Đã xử lý Race Condition
   */
  async registerEvent(eventId: string, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      try {
        // 1. Khóa bản ghi Event bằng Pessimistic Write Lock
        const event = await manager.findOne(Event, { 
          where: { id: eventId },
          lock: { mode: 'pessimistic_write' }
        });
        
        if (!event) throw new NotFoundException('Không tìm thấy sự kiện');

        // 2. Kiểm tra đăng ký trùng lặp trong transaction
        const existing = await manager.findOne(EventRegistration, {
          where: { event_id: eventId, user_id: userId },
        });
        if (existing) {
          throw new BadRequestException('Bạn đã đăng ký tham gia sự kiện này rồi!');
        }

        // 3. Kiểm tra sức chứa giới hạn
        if (event.registered_count >= event.capacity) {
          throw new BadRequestException('Sự kiện/Workshop đã hết chỗ!');
        }

        // 4. Tăng số lượng đã đăng ký (Atomic Increment)
        await manager.increment(Event, { id: eventId }, 'registered_count', 1);

        // 5. Tạo mã vé độc nhất
        const ticketCode = `TICKET-EVT-${eventId.substring(0, 8).toUpperCase()}-USR-${userId.substring(0, 8).toUpperCase()}-${Date.now()}`;

        // 6. Tạo ảnh QR Code dạng Data URL
        const qrCodeUrl = await QRCode.toDataURL(ticketCode);

        // 7. Lưu vé đăng ký
        const registration = manager.create(EventRegistration, {
          event_id: eventId,
          user_id: userId,
          status: 'registered',
          ticket_code: ticketCode,
        });
        await manager.save(registration);

        // 8. Cộng điểm Gamification (Đăng ký workshop = 100 XP)
        await this.gamificationService.awardPoints(
          userId,
          100
        );

        this.logger.log(`[EVENT REG SUCCESS] User ${userId} registered for event ${eventId}`);

        return {
          message: 'Đăng ký tham gia sự kiện thành công!',
          event_title: event.title,
          ticket_code: ticketCode,
          ticket_qr: qrCodeUrl,
          start_date: event.start_date,
          location: event.location,
        };
      } catch (error) {
        this.logger.error(`[EVENT REG FAILED] Event: ${eventId}, Error: ${error.message}`);
        throw error;
      }
    });
  }
}
