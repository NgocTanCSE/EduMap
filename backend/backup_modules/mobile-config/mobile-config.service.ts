import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MobileUnit, MobileUnitRoute } from './entities/mobile.entity';

@Injectable()
export class MobileConfigService {
  constructor(
    @InjectRepository(MobileUnit) private unitRepo: Repository<MobileUnit>,
    @InjectRepository(MobileUnitRoute) private routeRepo: Repository<MobileUnitRoute>,
  ) {}

  // 1. Qu?n l? tài nguyên & L? tr?nh (Resource & Route Management)
  async getUnitSchedule(unitId: string) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('MOB_001: Mobile unit not found');

    const routes = await this.routeRepo.find({ 
      where: { mobile_unit_id: unitId },
      order: { scheduled_at: 'ASC' }
    });

    return {
      unit_info: unit,
      resources: ['1000 Sách giáo khoa', '20 Máy tính b?ng', 'Máy chi?u'], // Gi? l?p tài nguyên
      upcoming_routes: routes
    };
  }

  // 2. C?p nh?t ð?nh v? th?i gian th?c (Tracking)
  async updateLocation(unitId: string, lat: number, lng: number) {
    // C?p nh?t v? trí PostGIS c?a xe
    const location = { type: 'Point', coordinates: [lng, lat] };
    await this.unitRepo.update(unitId, { current_location: location });
    return { success: true, message: 'Ð? c?p nh?t v? trí xe tri th?c lýu ð?ng.' };
  }

  // 3. Lên l?ch tr?nh m?i (Route Planning)
  async planRoute(unitId: string, destination: string, lat: number, lng: number, time: Date) {
    const route = this.routeRepo.create({
      mobile_unit_id: unitId,
      destination_name: destination,
      location: { type: 'Point', coordinates: [lng, lat] },
      scheduled_at: time,
      status: 'pending'
    });
    return this.routeRepo.save(route);
  }
}

