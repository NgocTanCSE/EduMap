import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

/**
 * Vietnam mainland split into 5 regions so Overpass queries stay fast &
 * rate-limit-safe. Mirrors crawlers/overpass_crawler.py (VIETNAM_REGIONS).
 */
const VIETNAM_REGIONS: Record<string, string> = {
  north: '20.5,102.0,23.5,106.5',
  north_central: '17.0,104.0,20.5,107.0',
  central: '14.0,105.0,17.0,109.0',
  south_central: '11.0,105.0,14.0,109.0',
  south: '8.0,104.0,11.5,107.5',
};

/** Overpass mirrors rotated like the Python crawler. */
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

/**
 * TypeORM `type_id` FK → `map_categories`:
 *   1=University, 2=HighSchool, 3=Library, 4=Bookstore, 5=STEM, 6=WiFi, 7=Green, 8=Cafe
 * (the previous code used type_id=9 for cafe which violates the FK — fixed here.)
 */
function classify(tags: Record<string, string>): { typeId: number; desc: string } {
  if (!tags) return { typeId: 8, desc: 'Cà phê học tập (Auto-crawled)' };
  if (tags.amenity === 'library') return { typeId: 3, desc: 'Thư viện công cộng (Auto-crawled)' };
  if (tags.shop === 'books' || tags.amenity === 'bookshop') return { typeId: 4, desc: 'Nhà sách (Auto-crawled)' };
  if (tags.amenity === 'university' || tags.amenity === 'college') return { typeId: 1, desc: 'Đại học / Cao đẳng (Auto-crawled)' };
  if (tags.amenity === 'school') return { typeId: 2, desc: 'Trường học (Auto-crawled)' };
  if (tags.amenity === 'cafe' || tags.amenity === 'fast_food') return { typeId: 8, desc: 'Cà phê học tập (Auto-crawled)' };
  if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'nature_reserve' || tags['natural'] === 'wood') return { typeId: 7, desc: 'Không gian xanh / Công viên (Auto-crawled)' };
  if (tags.amenity === 'internet_cafe' || tags.internet_access === 'wlan') return { typeId: 6, desc: 'Điểm WiFi công cộng (Auto-crawled)' };
  return { typeId: 8, desc: 'Địa điểm (Auto-crawled)' };
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
  private _mirrorIdx = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly aiService: AIService,
    @InjectRepository(MapPoint)
    private readonly mapRepo: Repository<MapPoint>,
  ) {}

  // ===== AUTO-CRAWL: nationwide Overpass at 00:00 daily (incremental upsert, NO schema wipe) =====
  @Cron('0 0 * * *')
  async handleMapCrawlingCron() {
    this.logger.log('Bắt đầu quy trình Crawl bản đồ tự động (00:00 hàng ngày, toàn quốc)...');
    await this.crawlNationwide();
  }

  private _overpassUrl(): string {
    const url = OVERPASS_MIRRORS[this._mirrorIdx % OVERPASS_MIRRORS.length];
    this._mirrorIdx += 1;
    return url;
  }

  /** Generic nationwide Overpass crawl over all 5 regions for a given query. */
  private async _crawlOverpass(
    queryFn: (bbox: string) => string,
    label: string,
  ): Promise<number> {
    let added = 0;
    for (const [region, bbox] of Object.entries(VIETNAM_REGIONS)) {
      const query = queryFn(bbox);
      const url = `${this._overpassUrl()}?data=${encodeURIComponent(query)}`;
      let elements: any[] = [];
      try {
        const response = await firstValueFrom(
          this.httpService.get(url, {
            headers: { 'User-Agent': 'EduMapNationwide/1.0 (admin@edumap.vn)' },
            timeout: 300_000,
          }),
        );
        elements = response.data.elements || [];
      } catch (e) {
        this.logger.warn(`[${label}/${region}] Overpass lỗi: ${e.message}; chuyển mirror`);
        continue;
      }
      this.logger.log(`[${label}/${region}] Tìm thấy ${elements.length} phần tử`);
      for (const el of elements) {
        const tags = el.tags || {};
        const name = tags.name || el.tags?.['name:vi'];
        if (!name) continue;
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        if (!lat || !lng) continue;
        try {
          const exists = await this.mapRepo
            .createQueryBuilder('map')
            .where('map.name = :name', { name })
            .orWhere('ST_DWithin(map.location, ST_MakePoint(:lng, :lat)::geography, 10)')
            .setParameters({ lng, lat })
            .getOne();
          if (exists) continue;

          const { typeId, desc } = classify(tags);
          const address = tags['addr:street']
            ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim()
            : 'Đang cập nhật';
          const city = tags['addr:city'] || region;

          await this.mapRepo.save(
            this.mapRepo.create({
              name,
              description: desc,
              type_id: typeId,
              city,
              address,
              location: { type: 'Point', coordinates: [lng, lat] } as any,
              status: 'approved', // nationwide crawl = đã duyệt (hiển thị)
              verified: false,
            }),
          );
          added++;
        } catch (e) {
          this.logger.warn(`[${label}] Bỏ qua ${name}: ${e.message}`);
        }
      }
    }
    this.logger.log(`[${label}] Hoàn tất. +${added} địa điểm mới (upsert, không xóa)`);
    return added;
  }

  /** Main nationwide Overpass crawl (all categories, 5 regions). */
  async crawlNationwide(): Promise<any> {
    try {
      let added = 0;
      added += await this._crawlOverpass(
        (bbox) => `
        [out:json][timeout:180];
        (
          node["amenity"~"school|library|university|kindergarten|college|hospital|clinic|pharmacy|doctors|dentist"](${bbox});
          way["amenity"~"school|library|university|kindergarten|college|hospital|clinic|pharmacy|doctors|dentist"](${bbox});
        );
        out center;
        `,
        'education_health',
      );
      added += await this._crawlOverpass(
        (bbox) => `
        [out:json][timeout:180];
        (
          node["amenity"~"restaurant|cafe|fast_food|bar|pub|internet_cafe"](${bbox});
          way["amenity"~"restaurant|cafe|fast_food|bar|pub|internet_cafe"](${bbox});
          node["shop"](${bbox});
          way["shop"](${bbox});
          node["internet_access"="wlan"](${bbox});
        );
        out center;
        `,
        'food_shops_wifi',
      );
      added += await this._crawlOverpass(
        (bbox) => `
        [out:json][timeout:180];
        (
          node["tourism"~"hotel|hostel|guest_house|motel|attraction|museum|zoo|camp_site|viewpoint"](${bbox});
          way["tourism"~"hotel|hostel|guest_house|motel|attraction|museum|zoo|camp_site|viewpoint"](${bbox});
          node["leisure"~"park|garden|nature_reserve|water_park|stadium|sports_centre"](${bbox});
          way["leisure"~"park|garden|nature_reserve|water_park|stadium|sports_centre"](${bbox});
          node["natural"~"wood|tree_row"](${bbox});
        );
        out center;
        `,
        'tourism_green',
      );
      return { success: true, added, message: `Đã quét toàn quốc. +${added} POIs mới.` };
    } catch (e) {
      this.logger.error('Lỗi crawl nationwide:', e);
      return { success: false, added: 0, message: `Lỗi: ${e.message}` };
    }
  }

  // Hạn chế: các crawl kiểu này còn lại dùng để crawl local/tỉnh (có thể truyền params)
  private DEFAULT_LAT = 10.98818;
  private DEFAULT_LNG = 106.85551;

  private async _crawlLocalQuery(
    query: string,
    label: string,
    classifyFn: (tags: Record<string, string>) => { typeId: number; desc: string },
  ): Promise<number> {
    const url = `${OVERPASS_MIRRORS[0]}?data=${encodeURIComponent(query)}`;
    let added = 0;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: { 'User-Agent': 'EduMap-Crawler/1.0' }, timeout: 60_000 }),
      );
      const elements = response.data.elements || [];
      for (const el of elements) {
        const name = el.tags?.name;
        if (!name) continue;
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        if (!lat || !lng) continue;
        const exists = await this.mapRepo
          .createQueryBuilder('map')
          .where('map.name = :name', { name })
          .orWhere('ST_DWithin(map.location, ST_MakePoint(:lng, :lat)::geography, 10)')
          .setParameters({ lng, lat })
          .getOne();
        if (exists) continue;
        const { typeId, desc } = classifyFn(el.tags || {});
        await this.mapRepo.save(
          this.mapRepo.create({
            name,
            description: desc,
            type_id: typeId,
            city: 'Biên Hòa',
            address: el.tags?.['addr:street']
              ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim()
              : 'Đang cập nhật',
            location: { type: 'Point', coordinates: [lng, lat] } as any,
            status: 'pending',
          }),
        );
        added++;
      }
    } catch (e) {
      this.logger.warn(`[${label}] ${e.message}`);
    }
    return added;
  }

  async crawlWifiLocations(params?: any): Promise<any> {
    const lat = params?.lat || this.DEFAULT_LAT;
    const lng = params?.lng || this.DEFAULT_LNG;
    const radius = params?.radius || 5000;
    const query = `[out:json];(node["internet_access"="wlan"](around:${radius},${lat},${lng});node["amenity"="internet_cafe"](around:${radius},${lat},${lng}););out body;`;
    const added = await this._crawlLocalQuery(query, 'wifi', (t) => ({ typeId: 6, desc: 'Điểm WiFi công cộng (Auto-crawled)' }));
    return { success: true, added, message: `Đã thêm ${added} WiFi location mới.` };
  }

  async crawlSchools(params?: any): Promise<any> {
    const lat = params?.lat || this.DEFAULT_LAT;
    const lng = params?.lng || this.DEFAULT_LNG;
    const radius = params?.radius || 5000;
    const query = `[out:json];(node["amenity"="school"](around:${radius},${lat},${lng});node["amenity"="university"](around:${radius},${lat},${lng});node["amenity"="college"](around:${radius},${lat},${lng}););out body;`;
    const added = await this._crawlLocalQuery(query, 'schools', (t) =>
      t.amenity === 'university' || t.amenity === 'college'
        ? { typeId: 1, desc: 'Đại học / Cao đẳng (Auto-crawled)' }
        : { typeId: 2, desc: 'Trường học (Auto-crawled)' },
    );
    return { success: true, added, message: `Đã thêm ${added} trường học mới.` };
  }

  async crawlGreenSpaces(params?: any): Promise<any> {
    const lat = params?.lat || this.DEFAULT_LAT;
    const lng = params?.lng || this.DEFAULT_LNG;
    const radius = params?.radius || 5000;
    const query = `[out:json];(way["leisure"="park"](around:${radius},${lat},${lng});way["landuse"="grass"](around:${radius},${lat},${lng});way["natural"="wood"](around:${radius},${lat},${lng}););out center body;`;
    const added = await this._crawlLocalQuery(query, 'green', (t) => ({ typeId: 7, desc: 'Không gian xanh / Công viên (Auto-crawled)' }));
    return { success: true, added, message: `Đã thêm ${added} không gian xanh mới.` };
  }

  async crawlBooks(params?: any): Promise<any> {
    try {
      const keyword = params?.keyword || 'computer science';
      const limit = params?.limit || 20;
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(keyword)}&limit=${limit}`;
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: { 'User-Agent': 'EduMap-Crawler/1.0' }, timeout: 30_000 }),
      );
      const docs = response.data.docs || [];
      let addedCount = 0;
      for (const doc of docs) {
        if (!doc.title) continue;
        const exists = await this.mapRepo.query('SELECT id FROM learning_materials WHERE title = $1 LIMIT 1', [doc.title]);
        if (exists && exists.length > 0) continue;
        const author = doc.author_name ? doc.author_name.join(', ') : 'Unknown';
        const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null;
        const olUrl = doc.key ? `https://openlibrary.org${doc.key}` : null;
        await this.mapRepo.query(
          'INSERT INTO learning_materials (title, description, type, subject, thumbnail_url, file_url, status) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING',
          [doc.title, `Author: ${author}${doc.first_publish_year ? ' | Year: ' + String(doc.first_publish_year) : ''}`, 'book', 'Information Technology', coverUrl, olUrl, 'published'],
        );
        addedCount++;
      }
      return { success: true, added: addedCount, message: `Đã thêm ${addedCount} cuốn sách mới.` };
    } catch (error) {
      this.logger.error('Lỗi crawl books:', error.message);
      return { success: false, added: 0, message: `Lỗi crawl books: ${error.message}` };
    }
  }

  // ===== Manual trigger (admin) =====
  async triggerCrawl(type: string, params?: any): Promise<any> {
    if (this.crawlStatus.isRunning) {
      return { success: false, message: 'A crawl process is already running' };
    }
    const validTypes = ['map', 'wifi', 'schools', 'books', 'green_spaces', 'all'];
    if (!validTypes.includes(type)) {
      return { success: false, message: `Invalid crawl type. Valid types: ${validTypes.join(', ')}` };
    }

    this.crawlStatus = { isRunning: true, currentType: type, startTime: new Date(), lastCompleted: null, totalCrawled: 0, errors: 0 };
    const historyEntry: CrawlHistory = {
      id: `crawl-${Date.now()}`, type, status: 'running', startTime: new Date(), endTime: null, recordsAdded: 0, errors: 0, message: 'Crawl in progress',
    };
    this.crawlHistory.push(historyEntry);

    try {
      let result;
      switch (type) {
        case 'map': result = await this.crawlNationwide(); break;
        case 'wifi': result = await this.crawlWifiLocations(params); break;
        case 'schools': result = await this.crawlSchools(params); break;
        case 'books': result = await this.crawlBooks(params); break;
        case 'green_spaces': result = await this.crawlGreenSpaces(params); break;
        case 'all': result = await this.crawlAll(params); break;
        default: result = { success: false, message: 'Unknown crawl type' };
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

  async crawlAll(params?: any): Promise<any> {
    const results: any[] = [];
    try {
      results.push({ type: 'map', ...(await this.crawlNationwide()) });
      results.push({ type: 'books', ...(await this.crawlBooks(params)) });
      const totalAdded = results.reduce((sum, r) => sum + (r.added || 0), 0);
      return { success: true, added: totalAdded, message: `Crawl tất cả xong. Tổng: ${totalAdded} bản ghi.`, details: results };
    } catch (error) {
      this.logger.error('Lỗi crawl tất cả:', error.message);
      return { success: false, added: 0, message: `Lỗi: ${error.message}`, details: results };
    }
  }

  async getCrawlStatus(): Promise<CrawlStatus> { return this.crawlStatus; }
  async getCrawlHistory(): Promise<CrawlHistory[]> { return this.crawlHistory.slice(-50); }
  async getCrawlStats(): Promise<any> {
    const totalCrawls = this.crawlHistory.length;
    const successfulCrawls = this.crawlHistory.filter((h) => h.status === 'success').length;
    const failedCrawls = this.crawlHistory.filter((h) => h.status === 'failed').length;
    const totalRecords = this.crawlHistory.reduce((sum, h) => sum + h.recordsAdded, 0);
    return {
      totalCrawls, successfulCrawls, failedCrawls,
      successRate: totalCrawls > 0 ? (successfulCrawls / totalCrawls * 100).toFixed(2) + '%' : '0%',
      totalRecords,
      lastCrawl: this.crawlHistory.length > 0 ? this.crawlHistory[this.crawlHistory.length - 1] : null,
    };
  }
  async getCrawlTypes(): Promise<string[]> { return ['map', 'wifi', 'schools', 'books', 'green_spaces', 'all']; }
}
