import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WifiLocation } from './entities/wifi.entity';

@Injectable()
export class WifiService {
  constructor(
    @InjectRepository(WifiLocation) private readonly wifiRepo: Repository<WifiLocation>,
  ) {}

  /**
   * Báo cáo điểm Wifi miễn phí mới (MOD-23)
   */
  async reportWifi(reporterId: string, data: any) {
    let location = null;
    if (data.latitude && data.longitude) {
      location = {
        type: 'Point',
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    const wifi = this.wifiRepo.create({
      ...data,
      location,
      reported_by: reporterId,
      verified: false,
    });
    return this.wifiRepo.save(wifi);
  }

  /**
   * Lấy danh sách tất cả các điểm Wifi công cộng
   */
  async getWifiPoints() {
    return this.wifiRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Tìm các điểm Wifi phủ sóng gần nhất qua bản đồ GIS PostGIS
   */
  async getWifiPointsNearby(lat: number, lng: number, radiusInMeters: number = 5000) {
    return this.wifiRepo.createQueryBuilder('wifi')
      .where(
        'ST_DWithin(wifi.location, ST_MakePoint(:lng, :lat)::geography, :radius)',
        { lat, lng, radius: radiusInMeters }
      )
      .orderBy('wifi.created_at', 'DESC')
      .getMany();
  }

  /**
   * F-24: Khảo sát & Đánh giá tốc độ mạng (Crowdsourced Speed Test)
   */
  async submitSpeedTest(wifiId: string, downloadSpeed: number, uploadSpeed: number, rating: number) {
    const wifi = await this.wifiRepo.findOne({ where: { id: wifiId } });
    if (!wifi) throw new NotFoundException('Điểm Wifi không tồn tại');

    // Cập nhật tốc độ trung bình của điểm WiFi dựa trên dữ liệu đóng góp mới
    const currentSpeed = wifi.speed_mbps || 20; // Tốc độ mặc định nếu chưa có
    const avgDownload = (downloadSpeed + currentSpeed) / 2;

    wifi.speed_mbps = Number(avgDownload.toFixed(1));
    await this.wifiRepo.save(wifi);

    return {
      success: true,
      message: 'Cảm ơn bạn đã đóng góp đo lường tốc độ mạng thực tế cho cộng đồng học tập.',
      wifi_id: wifiId,
      new_stats: {
        avg_speed_mbps: wifi.speed_mbps,
        measured_download: downloadSpeed,
        measured_upload: uploadSpeed,
        user_rating: rating,
      }
    };
  }
}
