import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MobileUnit, MobileUnitRoute } from './entities/mobile.entity';

@Injectable()
export class MobileConfigService {
  constructor(
    @InjectRepository(MobileUnit) private readonly unitRepo: Repository<MobileUnit>,
    @InjectRepository(MobileUnitRoute) private readonly routeRepo: Repository<MobileUnitRoute>,
  ) {}

  /**
   * Đăng ký xe tri thức lưu động mới (MOD-26)
   */
  async createUnit(data: any) {
    let currentLocation = null;
    if (data.latitude && data.longitude) {
      currentLocation = {
        type: 'Point',
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    const unit = this.unitRepo.create({
      ...data,
      current_location: currentLocation,
      status: 'active',
    });
    return this.unitRepo.save(unit);
  }

  /**
   * Lấy danh sách tất cả các xe tri thức lưu động
   */
  async getUnits() {
    return this.unitRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * F-26: Quản lý tài nguyên & Lộ trình di chuyển
   */
  async getUnitSchedule(unitId: string) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Không tìm thấy xe tri thức lưu động yêu cầu');

    const routes = await this.routeRepo.find({
      where: { mobile_unit_id: unitId },
      order: { scheduled_at: 'ASC' },
    });

    return {
      unit_info: unit,
      resources: [
        '1,200 cuốn Sách giáo khoa & Sách tham khảo khoa học',
        '24 máy tính bảng kết nối Internet học tập trực tuyến',
        '01 máy chiếu công suất lớn phục vụ lớp học lưu động ngoài trời',
        'Bộ công cụ thực nghiệm STEM cơ bản',
      ],
      upcoming_routes: routes,
    };
  }

  /**
   * Cập nhật vị trí GPS thời gian thực (Real-time Tracking)
   */
  async updateLocation(unitId: string, lat: number, lng: number) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Không tìm thấy xe tri thức lưu động yêu cầu');

    unit.current_location = {
      type: 'Point',
      coordinates: [Number(lng), Number(lat)],
    };

    await this.unitRepo.save(unit);

    return {
      success: true,
      message: `Đã cập nhật vị trí GPS thời gian thực của xe tri thức lưu động: ${unit.name} thành công.`,
      unit_id: unitId,
      coordinates: [lng, lat],
    };
  }

  /**
   * Lên kế hoạch lộ trình điểm đến tiếp theo (Route Planning)
   */
  async planRoute(unitId: string, destination: string, lat: number, lng: number, time: Date) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Không tìm thấy xe tri thức lưu động yêu cầu');

    const route = this.routeRepo.create({
      mobile_unit_id: unitId,
      destination_name: destination,
      location: {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)],
      },
      scheduled_at: time,
      status: 'pending',
    });

    return this.routeRepo.save(route);
  }
}
