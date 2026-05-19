import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WifiLocation } from './entities/wifi.entity';

@Injectable()
export class WifiService {
  constructor(
    @InjectRepository(WifiLocation) private wifiRepo: Repository<WifiLocation>,
  ) {}

  // 1. Kh?o sát & Test t?c ð? m?ng (Speed Test & User Reviews)
  async submitSpeedTest(wifiId: string, downloadSpeed: number, uploadSpeed: number, rating: number) {
    const wifi = await this.wifiRepo.findOne({ where: { id: wifiId } });
    if (!wifi) throw new NotFoundException('WIF_001: Ði?m Wifi không t?n t?i');

    // Thu?t toán: Tính trung b?nh c?ng t?c ð? và rating d?a trên d? li?u m?i c?ng d?n (Crowdsourced data)
    // Gi? l?p c?p nh?t
    const avgDownload = (downloadSpeed + 45) / 2; // Ví d?
    return {
      success: true,
      message: 'C?m õn b?n ð? ðóng góp d? li?u.',
      new_stats: { avg_download: avgDownload, new_rating: rating }
    };
  }
}

