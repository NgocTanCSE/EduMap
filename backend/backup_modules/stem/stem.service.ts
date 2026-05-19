import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StemLab } from './entities/stem.entity';

@Injectable()
export class StemService {
  constructor(
    @InjectRepository(StemLab) private labRepo: Repository<StemLab>,
  ) {}

  // 1. Ð?t mý?n thi?t b? ch?ng trùng l?ch (Equipment Booking Conflict Resolution)
  async bookEquipment(userId: string, labId: string, equipmentName: string, startTime: Date, endTime: Date) {
    const lab = await this.labRepo.findOne({ where: { id: labId } });
    if (!lab) throw new NotFoundException('STM_001: Lab không t?n t?i');

    // Logic ch?ng trùng: 
    // Trong th?c t? s? SELECT * FROM lab_bookings WHERE equipment = ? AND (start < ? AND end > ?)
    // ? ðây ta gi? l?p m?t hàm ki?m tra
    const isConflict = false; // Ð?i thành true ð? test l?i
    
    if (isConflict) {
      throw new ConflictException('STM_002: Thi?t b? này ð? có ngý?i ð?t trong khung gi? b?n ch?n!');
    }

    return {
      success: true,
      message: Ð? ð?t thành công \ t? \ ð?n \.,
      booking_id: 'BKG-1002'
    };
  }
}

