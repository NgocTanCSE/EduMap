import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapPoint } from '../map/entities/map-point.entity';
import { AIService } from '../ai/ai.service';
import { firstValueFrom } from 'rxjs';

export interface CrawlStatus {
  isRunning: boolean;
  currentType: string | null;
  startTime: Date | null;
  lastCompleted: Date | null;
  totalCrawled: number;
  errors: number;
}

export interface CrawlHistory {
  id: string;
  type: string;
  status: 'success' | 'failed' | 'running';
  startTime: Date;
  endTime: Date | null;
  recordsAdded: number;
  errors: number;
  message: string;
}


@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private crawlStatus: CrawlStatus = {
    isRunning: false,
    currentType: null,
    startTime: null,
    lastCompleted: null,
    totalCrawled: 0,
    errors: 0,
  };
  private crawlHistory: CrawlHistory[] = [];

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

  async triggerCrawl(type: string, params?: any): Promise<any> {
    if (this.crawlStatus.isRunning) {
      return { success: false, message: 'A crawl process is already running' };
    }

    const validTypes = ['map', 'wifi', 'schools', 'books', 'green_spaces', 'all'];
    if (!validTypes.includes(type)) {
      return { success: false, message: `Invalid crawl type. Valid types: ${validTypes.join(', ')}` };
    }

    this.crawlStatus = {
      isRunning: true,
      currentType: type,
      startTime: new Date(),
      lastCompleted: null,
      totalCrawled: 0,
      errors: 0,
    };

    const historyEntry: CrawlHistory = {
      id: `crawl-${Date.now()}`,
      type,
      status: 'running',
      startTime: new Date(),
      endTime: null,
      recordsAdded: 0,
      errors: 0,
      message: 'Crawl in progress',
    };

    this.crawlHistory.push(historyEntry);

    try {
      let result;
      switch (type) {
        case 'map':
          result = await this.crawlDNTUSurroundings();
          break;
        case 'wifi':
          result = await this.crawlWifiLocations(params);
          break;
        case 'schools':
          result = await this.crawlSchools(params);
          break;
        case 'books':
          result = await this.crawlBooks(params);
          break;
        case 'green_spaces':
          result = await this.crawlGreenSpaces(params);
          break;
        case 'all':
          result = await this.crawlAll(params);
          break;
        default:
          result = { success: false, message: 'Unknown crawl type' };
      }

      historyEntry.status = result.success ? 'success' : 'failed';
      historyEntry.recordsAdded = result.added || 0;
      historyEntry.message = result.message || (result.success ? 'Crawl completed' : 'Crawl failed');
      historyEntry.endTime = new Date();

      this.crawlStatus.lastCompleted = new Date();
      this.crawlStatus.totalCrawled += result.added || 0;

      return result;
    } catch (error) {
      historyEntry.status = 'failed';
      historyEntry.errors++;
      historyEntry.message = error.message;
      historyEntry.endTime = new Date();
      this.crawlStatus.errors++;

      return { success: false, error: error.message };
    } finally {
      this.crawlStatus.isRunning = false;
      this.crawlStatus.currentType = null;
    }
  }

  async getCrawlStatus(): Promise<CrawlStatus> {
    return this.crawlStatus;
  }

  async getCrawlHistory(): Promise<CrawlHistory[]> {
    return this.crawlHistory.slice(-50); // Return last 50 crawl records
  }

  async getCrawlStats(): Promise<any> {
    const totalCrawls = this.crawlHistory.length;
    const successfulCrawls = this.crawlHistory.filter(h => h.status === 'success').length;
    const failedCrawls = this.crawlHistory.filter(h => h.status === 'failed').length;
    const totalRecords = this.crawlHistory.reduce((sum, h) => sum + h.recordsAdded, 0);

    return {
      totalCrawls,
      successfulCrawls,
      failedCrawls,
      successRate: totalCrawls > 0 ? (successfulCrawls / totalCrawls * 100).toFixed(2) + '%' : '0%',
      totalRecords,
      lastCrawl: this.crawlHistory.length > 0 ? this.crawlHistory[this.crawlHistory.length - 1] : null,
    };
  }

  async getCrawlTypes(): Promise<string[]> {
    return ['map', 'wifi', 'schools', 'books', 'green_spaces', 'all'];
  }

  private async crawlWifiLocations(params?: any): Promise<any> {
    try {
      const lat = params?.lat || 10.98818;
      const lng = params?.lng || 106.85551;
      const radius = params?.radius || 5000;
      this.logger.log(`Crawl WiFi trong ban kinh ${radius}m...`);
      const query = `[out:json];(node["internet_access"="wlan"](around:${radius},${lat},${lng});node["amenity"="internet_cafe"](around:${radius},${lat},${lng});node["wifi"="yes"](around:${radius},${lat},${lng}););out body;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const response = await firstValueFrom(this.httpService.get(url, { headers: { "User-Agent": "EduMap-Crawler/1.0" }, timeout: 30000 }));
      const elements = response.data.elements || [];
      this.logger.log(`Tim thay ${elements.length} WiFi locations.`);
      let addedCount = 0;
      for (const el of elements) {
        if (!el.lat || !el.lon) continue;
        const name = el.tags?.name || `WiFi Hotspot ${el.lat.toFixed(4)}`;
        const exists = await this.mapRepo.createQueryBuilder("map").where("map.name = :name", { name }).orWhere("ST_DWithin(map.location, ST_MakePoint(:lng, :lat)::geography, 10)").setParameters({ lng: el.lon, lat: el.lat }).getOne();
        if (exists) continue;
        const address = el.tags?.["addr:street"] ? `${el.tags["addr:housenumber"] || ""} ${el.tags["addr:street"]}`.trim() : "Dang cap nhat";
        await this.mapRepo.save(this.mapRepo.create({ name, description: "Diem WiFi cong cong (Auto-crawled)", type_id: 6, city: "Bien Hoa", address, location: { type: "Point", coordinates: [el.lon, el.lat] }, status: "pending" }));
        addedCount++;
      }
      return { success: true, added: addedCount, message: `Da them ${addedCount} WiFi location moi.` };
    } catch (error) {
      this.logger.error("Loi crawl WiFi:", error.message);
      return { success: false, added: 0, message: `Loi crawl WiFi: ${error.message}` };
    }
  }

  private async crawlSchools(params?: any): Promise<any> {
    try {
      const lat = params?.lat || 10.98818;
      const lng = params?.lng || 106.85551;
      const radius = params?.radius || 5000;
      this.logger.log(`Crawl schools trong ban kinh ${radius}m...`);
      const query = `[out:json];(node["amenity"="school"](around:${radius},${lat},${lng});node["amenity"="university"](around:${radius},${lat},${lng});node["amenity"="college"](around:${radius},${lat},${lng}););out body;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const response = await firstValueFrom(this.httpService.get(url, { headers: { "User-Agent": "EduMap-Crawler/1.0" }, timeout: 30000 }));
      const elements = response.data.elements || [];
      this.logger.log(`Tim thay ${elements.length} schools tho.`);
      let addedCount = 0;
      for (const el of elements) {
        if (!el.lat || !el.lon || !el.tags?.name) continue;
        const exists = await this.mapRepo.createQueryBuilder("map").where("map.name = :name", { name: el.tags.name }).orWhere("ST_DWithin(map.location, ST_MakePoint(:lng, :lat)::geography, 10)").setParameters({ lng: el.lon, lat: el.lat }).getOne();
        if (exists) continue;
        let typeId = 2; let desc = "Truong hoc (Auto-crawled)";
        if (el.tags.amenity === "university" || el.tags.amenity === "college") { typeId = 1; desc = "Dai hoc / Cao dang (Auto-crawled)"; }
        const address = el.tags?.["addr:street"] ? `${el.tags["addr:housenumber"] || ""} ${el.tags["addr:street"]}`.trim() : "Dang cap nhat";
        await this.mapRepo.save(this.mapRepo.create({ name: el.tags.name, description: desc, type_id: typeId, city: "Bien Hoa", address, location: { type: "Point", coordinates: [el.lon, el.lat] }, status: "pending" }));
        addedCount++;
      }
      return { success: true, added: addedCount, message: `Da them ${addedCount} truong hoc moi.` };
    } catch (error) {
      this.logger.error("Loi crawl schools:", error.message);
      return { success: false, added: 0, message: `Loi crawl schools: ${error.message}` };
    }
  }

  private async crawlBooks(params?: any): Promise<any> {
    try {
      const keyword = params?.keyword || "computer science";
      const limit = params?.limit || 20;
      this.logger.log(`Crawl books voi tu khoa "${keyword}"...`);
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(keyword)}&limit=${limit}`;
      const response = await firstValueFrom(this.httpService.get(url, { headers: { "User-Agent": "EduMap-Crawler/1.0" }, timeout: 30000 }));
      const docs = response.data.docs || [];
      this.logger.log(`Tim thay ${docs.length} books tu Open Library.`);
      let addedCount = 0;
      for (const doc of docs) {
        if (!doc.title) continue;
        const exists = await this.mapRepo.query("SELECT id FROM learning_materials WHERE title = $1 LIMIT 1", [doc.title]);
        if (exists && exists.length > 0) continue;
        const author = doc.author_name ? doc.author_name.join(", ") : "Unknown";
        const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null;
        const olUrl = doc.key ? `https://openlibrary.org${doc.key}` : null;
        await this.mapRepo.query("INSERT INTO learning_materials (title, description, type, subject, thumbnail_url, file_url, status) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING", [doc.title, `Author: ${author}${doc.first_publish_year ? " | Year: " + String(doc.first_publish_year) : ""}`, "book", "Information Technology", coverUrl, olUrl, "published"]);
        addedCount++;
      }
      return { success: true, added: addedCount, message: `Da them ${addedCount} cuon sach moi.` };
    } catch (error) {
      this.logger.error("Loi crawl books:", error.message);
      return { success: false, added: 0, message: `Loi crawl books: ${error.message}` };
    }
  }

  private async crawlGreenSpaces(params?: any): Promise<any> {
    try {
      const lat = params?.lat || 10.98818;
      const lng = params?.lng || 106.85551;
      const radius = params?.radius || 5000;
      this.logger.log(`Crawl green spaces trong ban kinh ${radius}m...`);
      const query = `[out:json];(way["leisure"="park"](around:${radius},${lat},${lng});way["landuse"="grass"](around:${radius},${lat},${lng});way["natural"="wood"](around:${radius},${lat},${lng}););out center body;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const response = await firstValueFrom(this.httpService.get(url, { headers: { "User-Agent": "EduMap-Crawler/1.0" }, timeout: 30000 }));
      const elements = response.data.elements || [];
      this.logger.log(`Tim thay ${elements.length} green spaces tho.`);
      let addedCount = 0;
      for (const el of elements) {
        const elLat = el.center?.lat || el.lat;
        const elLng = el.center?.lon || el.lon;
        if (!elLat || !elLng) continue;
        const name = el.tags?.name || `Khong gian xanh ${elLat.toFixed(4)}`;
        const exists = await this.mapRepo.createQueryBuilder("map").where("map.name = :name", { name }).orWhere("ST_DWithin(map.location, ST_MakePoint(:lng, :lat)::geography, 10)").setParameters({ lng: elLng, lat: elLat }).getOne();
        if (exists) continue;
        const desc = el.tags?.leisure === "park" ? "Cong vien / Khong gian xanh (Auto-crawled)" : "Khu vuc xanh / Thuc vat (Auto-crawled)";
        await this.mapRepo.save(this.mapRepo.create({ name, description: desc, type_id: 7, city: "Bien Hoa", address: "Dang cap nhat", location: { type: "Point", coordinates: [elLng, elLat] }, status: "pending" }));
        addedCount++;
      }
      return { success: true, added: addedCount, message: `Da them ${addedCount} khong gian xanh moi.` };
    } catch (error) {
      this.logger.error("Loi crawl green spaces:", error.message);
      return { success: false, added: 0, message: `Loi crawl green spaces: ${error.message}` };
    }
  }

  private async crawlAll(params?: any): Promise<any> {
    const results: any[] = [];
    try {
      this.logger.log("Bat dau crawl tat ca cac loai du lieu...");
      results.push({ type: "map", ...(await this.crawlDNTUSurroundings()) });
      results.push({ type: "wifi", ...(await this.crawlWifiLocations(params)) });
      results.push({ type: "schools", ...(await this.crawlSchools(params)) });
      results.push({ type: "books", ...(await this.crawlBooks(params)) });
      results.push({ type: "green_spaces", ...(await this.crawlGreenSpaces(params)) });
      const totalAdded = results.reduce((sum, r) => sum + (r.added || 0), 0);
      this.logger.log(`Crawl tat ca hoan tat. Tong cong: ${totalAdded} ban ghi moi.`);
      return { success: true, added: totalAdded, message: `Da crawl xong tat ca. Tong: ${totalAdded} ban ghi moi.`, details: results };
    } catch (error) {
      this.logger.error("Loi crawl tat ca:", error.message);
      return { success: false, added: 0, message: `Loi crawl tat ca: ${error.message}`, details: results };
    }
  }
}
