import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapPoint } from '../map/entities/map-point.entity';
import { AIService } from '../ai/ai.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly aiService: AIService,
    @InjectRepository(MapPoint)
    private readonly mapRepo: Repository<MapPoint>,
  ) {}

  // Chạy tự động vào lúc 2:00 sáng Thứ Hai hàng tuần
  @Cron('0 2 * * 1')
  async handleMapCrawlingCron() {
    this.logger.log('Bắt đầu quy trình Crawl bản đồ tự động (CronJob)...');
    await this.crawlDNTUSurroundings();
  }

  // Hàm Crawl chính, có thể gọi thủ công từ Admin Controller
  async crawlDNTUSurroundings() {
    try {
      // Tọa độ DNTU
      const dntuLat = 10.98818;
      const dntuLng = 106.85551;
      const radius = 5000; // Bán kính 5km

      this.logger.log(`Bắt đầu quét Overpass API trong bán kính ${radius}m quanh DNTU...`);

      // Sử dụng Overpass API (OpenStreetMap) để lấy dữ liệu có độ chính xác cực cao
      const query = `
        [out:json];
        (
          node["amenity"="cafe"](around:${radius},${dntuLat},${dntuLng});
          node["amenity"="library"](around:${radius},${dntuLat},${dntuLng});
          node["shop"="books"](around:${radius},${dntuLat},${dntuLng});
          node["leisure"="park"](around:${radius},${dntuLat},${dntuLng});
        );
        out body;
      `;

      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent': 'EduMap-Crawler/1.0 (admin@edumap.vn)'
          }
        })
      );
      
      const elements = response.data.elements || [];
      this.logger.log(`Tìm thấy ${elements.length} địa điểm thô từ Overpass API.`);

      let addedCount = 0;

      for (const el of elements) {
        if (!el.tags || !el.tags.name) continue;

        const name = el.tags.name;
        const lat = el.lat;
        const lng = el.lon;
        
        // 1. Kiểm tra xem đã có trong DB chưa (tránh trùng lặp)
        // Tìm điểm nào có tên giống hoặc tọa độ quá gần (< 10m)
        const exists = await this.mapRepo.createQueryBuilder('map')
          .where('map.name = :name', { name })
          .orWhere('ST_DWithin(map.location, ST_MakePoint(:lng, :lat)::geography, 10)')
          .setParameters({ lng, lat })
          .getOne();

        if (exists) continue;

        // 2. Lọc và Phân loại
        let typeId = 9; // Default: Cafe học tập
        let desc = 'Quán cafe tự động quét';
        
        if (el.tags.amenity === 'library') {
          typeId = 3;
          desc = 'Thư viện công cộng (Auto-crawled)';
        } else if (el.tags.shop === 'books') {
          typeId = 8;
          desc = 'Nhà sách (Auto-crawled)';
        } else if (el.tags.leisure === 'park') {
          typeId = 6;
          desc = 'Không gian xanh / Công viên (Auto-crawled)';
        }

        // 3. (Tùy chọn tương lai) Dùng Gemini AI để phân tích tên/mô tả xem có thực sự hợp sinh viên không
        // const aiCheck = await this.aiService.analyzePlace(...);

        // 4. Lưu vào DB dưới dạng 'pending' (chờ Admin duyệt)
        const newPoint = this.mapRepo.create({
          name: name,
          description: desc,
          type_id: typeId,
          city: 'Biên Hòa',
          address: el.tags['addr:street'] ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim() : 'Đang cập nhật',
          location: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          status: 'pending', // <--- Rất quan trọng, để admin duyệt
        });

        await this.mapRepo.save(newPoint);
        addedCount++;
      }

      this.logger.log(`Crawl thành công. Đã thêm ${addedCount} địa điểm mới vào danh sách chờ duyệt.`);
      return { success: true, added: addedCount, message: `Đã tìm thấy ${addedCount} địa điểm mới.` };
      
    } catch (error) {
      this.logger.error('Lỗi trong quá trình crawl dữ liệu bản đồ:', error);
      return { success: false, error: error.message };
    }
  }
}
