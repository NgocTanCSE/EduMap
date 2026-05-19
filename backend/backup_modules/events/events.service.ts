import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workshop } from './entities/workshop.entity';
import * as QRCode from 'qrcode';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Workshop)
    private workshopRepository: Repository<Workshop>,
  ) {}

  /**
   * Flow #5: Workshop Registration Flow
   * Quy trinh dang ky, kiem tra cho va xuat ve
   */
  async register(workshopId: string, userId: string) {
    const workshop = await this.workshopRepository.findOne({ where: { id: workshopId } });
    if (!workshop) throw new NotFoundException('Khong tim thay workshop');

    // 1. Kiem tra so luong cho
    if (workshop.current_participants >= workshop.max_participants) {
      throw new BadRequestException('Workshop da het cho!');
    }

    // 2. Cap nhat so luong cho
    workshop.current_participants += 1;
    await this.workshopRepository.save(workshop);

    // 3. Tao ve QR Code (Simulation)
    const ticketData = TICKET-WS-\-USR-\;
    const qrCodeUrl = await QRCode.toDataURL(ticketData);

    // 4. Return thong tin ve va thong bao (Can goi NotificationService sau nay)
    return {
      message: 'Dang ky thanh cong!',
      workshop_title: workshop.title,
      ticket_qr: qrCodeUrl,
      start_date: workshop.start_date,
    };
  }
}
