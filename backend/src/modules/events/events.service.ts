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
    constructor(private readonly gamificationService: GamificationService, private readonly dataSource: DataSource, 
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>, 
    @InjectRepository(EventRegistration)
    private readonly registrationRepository: Repository<EventRegistration>) { }
    async createEvent(organizerId: string, data: any) {
        if (!data?.title || !data?.description || !data?.start_date || !data?.end_date) {
            throw new BadRequestException('Thiếu thông tin bắt buộc của sự kiện');
        }
        const { latitude, longitude, ...eventData } = data;
        const event = this.eventRepository.create({
            ...eventData,
            location: this.buildLocation(data),
            organizer_id: organizerId,
            registered_count: 0,
        });
        return this.eventRepository.save(event);
    }
    async updateEvent(id: string, data: any) {
        const event = await this.eventRepository.findOne({ where: { id } });
        if (!event)
            throw new NotFoundException('Không tìm thấy sự kiện');
        const { latitude, longitude, ...eventData } = data;
        Object.assign(event, eventData);
        const location = this.buildLocation(data);
        if (location)
            event.location = location;
        return this.eventRepository.save(event);
    }
    private buildLocation(data: any): any {
        if (data?.location && typeof data.location === 'object') {
            return data.location;
        }
        const latitude = Number(data?.latitude);
        const longitude = Number(data?.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            return { type: 'Point', coordinates: [longitude, latitude] };
        }
        return undefined;
    }
    async getEvents() {
        return this.eventRepository.find({ order: { start_date: 'ASC' } });
    }
    async getEventById(id: string) {
        const event = await this.eventRepository.findOne({ where: { id } });
        if (!event)
            throw new NotFoundException('Không tìm thấy sự kiện');
        return event;
    }
    async registerEvent(eventId: string, userId: string) {
        return await this.dataSource.transaction(async (manager) => {
            try {
                const event = await manager.findOne(Event, {
                    where: { id: eventId },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!event)
                    throw new NotFoundException('Không tìm thấy sự kiện');
                const existing = await manager.findOne(EventRegistration, {
                    where: { event_id: eventId, user_id: userId },
                });
                if (existing) {
                    throw new BadRequestException('Bạn đã đăng ký tham gia sự kiện này rồi!');
                }
                if (event.registered_count >= event.capacity) {
                    throw new BadRequestException('Sự kiện/Workshop đã hết chỗ!');
                }
                await manager.increment(Event, { id: eventId }, 'registered_count', 1);
                const ticketCode = `TICKET-EVT-${eventId.substring(0, 8).toUpperCase()}-USR-${userId.substring(0, 8).toUpperCase()}-${Date.now()}`;
                const qrCodeUrl = await QRCode.toDataURL(ticketCode);
                const registration = manager.create(EventRegistration, {
                    event_id: eventId,
                    user_id: userId,
                    status: 'registered',
                    ticket_code: ticketCode,
                });
                await manager.save(registration);
                await this.gamificationService.awardPoints(userId, 100);
                this.logger.log(`[EVENT REG SUCCESS] User ${userId} registered for event ${eventId}`);
                return {
                    message: 'Đăng ký tham gia sự kiện thành công!',
                    event_title: event.title,
                    ticket_code: ticketCode,
                    ticket_qr: qrCodeUrl,
                    start_date: event.start_date,
                    location: event.location,
                    address: event.address,
                };
            }
            catch (error: any) {
                this.logger.error(`[EVENT REG FAILED] Event: ${eventId}, Error: ${error.message}`);
                throw error;
            }
        });
    }
}
