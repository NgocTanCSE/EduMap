import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventRegistration } from './entities/event.entity';
import * as QRCode from 'qrcode';

@Injectable()
export class EventsService {
  constructor(
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
   * F-13: Đăng ký tham gia workshop/sự kiện (Tạo ticket & QR Code)
   */
  async registerEvent(eventId: string, userId: string) {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện');

    // 1. Kiểm tra đăng ký trùng lặp
    const existing = await this.registrationRepository.findOne({
      where: { event_id: eventId, user_id: userId },
    });
    if (existing) {
      throw new BadRequestException('Bạn đã đăng ký tham gia sự kiện này rồi!');
    }

    // 2. Kiểm tra sức chứa giới hạn
    if (event.registered_count >= event.capacity) {
      throw new BadRequestException('Sự kiện/Workshop đã hết chỗ!');
    }

    // 3. Tăng số lượng đã đăng ký
    event.registered_count += 1;
    await this.eventRepository.save(event);

    // 4. Tạo mã vé độc nhất
    const ticketCode = `TICKET-EVT-${eventId.substring(0, 8).toUpperCase()}-USR-${userId.substring(0, 8).toUpperCase()}-${Date.now()}`;

    // 5. Tạo ảnh QR Code dạng Data URL
    const qrCodeUrl = await QRCode.toDataURL(ticketCode);

    // 6. Lưu vé đăng ký
    const registration = this.registrationRepository.create({
      event_id: eventId,
      user_id: userId,
      status: 'registered',
      ticket_code: ticketCode,
    });
    await this.registrationRepository.save(registration);

    return {
      message: 'Đăng ký tham gia sự kiện thành công!',
      event_title: event.title,
      ticket_code: ticketCode,
      ticket_qr: qrCodeUrl,
      start_date: event.start_date,
      location: event.location,
    };
  }
}
