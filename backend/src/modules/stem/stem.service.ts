import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StemLab } from './entities/stem.entity';

@Injectable()
export class StemService {
  constructor(
    @InjectRepository(StemLab) private readonly labRepo: Repository<StemLab>,
  ) {}

  /**
   * Đăng ký phòng LAB STEM mới (MOD-20)
   */
  async registerLab(data: any) {
    let location = null;
    if (data.latitude && data.longitude) {
      location = {
        type: 'Point',
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    const lab = this.labRepo.create({
      ...data,
      location,
      equipment: data.equipment || [],
    });
    return this.labRepo.save(lab);
  }

  /**
   * Lấy danh sách tất cả phòng LAB STEM
   */
  async getLabs() {
    return this.labRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Tìm kiếm phòng LAB gần nhất qua bản đồ GIS PostGIS
   */
  async getLabsNearby(lat: number, lng: number, radiusInMeters: number = 10000) {
    return this.labRepo.createQueryBuilder('lab')
      .where(
        'ST_DWithin(lab.location, ST_MakePoint(:lng, :lat)::geography, :radius)',
        { lat, lng, radius: radiusInMeters }
      )
      .orderBy('lab.created_at', 'DESC')
      .getMany();
  }

  /**
   * Đặt mượn thiết bị LAB STEM chống trùng lịch
   */
  async bookEquipment(userId: string, labId: string, equipmentName: string, startTime: Date, endTime: Date) {
    const lab = await this.labRepo.findOne({ where: { id: labId } });
    if (!lab) throw new NotFoundException('Lab không tồn tại');

    // Chống trùng lịch đặt thiết bị: Trong thực tế sẽ SELECT kiểm tra bảng `lab_bookings`
    // Giả lập logic kiểm tra:
    const isConflict = false; // Thay thành true để test lỗi
    
    if (isConflict) {
      throw new ConflictException('Thiết bị này đã có người đặt trong khung giờ bạn chọn!');
    }

    return {
      success: true,
      booking_id: `STEM-BKG-${labId.substring(0, 8).toUpperCase()}-${userId.substring(0, 8).toUpperCase()}-${Date.now()}`,
      equipment: equipmentName,
      start_time: startTime,
      end_time: endTime,
      message: `Đặt mượn thiết bị ${equipmentName} thành công từ ${startTime} đến ${endTime}.`,
    };
  }
}
