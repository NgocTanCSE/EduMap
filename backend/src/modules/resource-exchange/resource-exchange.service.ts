import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource, ResourceType, ResourceStatus } from './entities/resource.entity';
import { ResourceRequest, RequestUrgency, RequestStatus } from './entities/resource-request.entity';
import { ResourceMatch, MatchStatus } from './entities/resource-match.entity';
import { AIService } from '../ai/ai.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { CreateResourceRequestDto } from './dto/create-resource-request.dto';
import { ResourceMatchRankDto } from './dto/resource-match-rank.dto';

export interface ScoredPair {
  resource_id: string;
  request_id: string;
  match_score: number;
  match_reasons: string[];
  resource: any;
  request: any;
}

export interface MatchResourcesResponse {
  ranked_matches: any[];
  pre_filter_summary: {
    total_resources: number;
    total_requests: number;
    pre_filtered_pairs: number;
    max_pairs: number;
  };
  transport_plan?: any;
  degraded: boolean;
  reason?: string;
}

/** Mức trọng số urgency → need_level (higher = more urgent). */
const URGENCY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Hằng số tính điểm khả dụng thời gian (xem resource có trễ deadline không). */
const now = () => Date.now();

@Injectable()
export class ResourceMatchService {
  private readonly logger = new Logger(ResourceMatchService.name);

  /** Safety-net cap for candidate pairs sent to the LLM. */
  private static readonly MAX_PAIRS_TO_LLM = 15;

  constructor(
    @InjectRepository(Resource) private readonly resourceRepo: Repository<Resource>,
    @InjectRepository(ResourceRequest) private readonly requestRepo: Repository<ResourceRequest>,
    @InjectRepository(ResourceMatch) private readonly matchRepo: Repository<ResourceMatch>,
    private readonly aiService: AIService,
  ) {}

  // ── RESOURCES ─────────────────────────────────────────────────────────────────

  async getResources(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    location?: string;
  }): Promise<{
    items: Resource[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.resourceRepo
      .createQueryBuilder('resource')
      .where('resource.status = :status', { status: ResourceStatus.AVAILABLE });

    if (params.type) qb.andWhere('resource.type = :type', { type: params.type });
    if (params.location)
      qb.andWhere('LOWER(resource.location) LIKE :loc', {
        loc: `%${params.location.toLowerCase()}%`,
      });

    const [items, total] = await qb
      .orderBy('resource.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getResourceById(id: string): Promise<Resource> {
    const resource = await this.resourceRepo.findOne({ where: { id } });
    if (!resource) throw new NotFoundException('Nguồn lực không tồn tại');
    return resource;
  }

  async createResource(data: CreateResourceDto): Promise<Resource> {
    return this.resourceRepo.save(
      this.resourceRepo.create({
        ...data,
        status: ResourceStatus.AVAILABLE,
        is_verified: data.is_verified ?? false,
      }),
    );
  }

  // ── REQUESTS ─────────────────────────────────────────────────────────────────

  async getResourceRequests(params: {
    page?: number;
    limit?: number;
    need_type?: string;
    status?: string;
    location?: string;
  }): Promise<{
    items: ResourceRequest[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.requestRepo
      .createQueryBuilder('request')
      .where('request.status = :status', { status: RequestStatus.OPEN });

    if (params.need_type) qb.andWhere('request.need_type = :t', { t: params.need_type });
    if (params.location)
      qb.andWhere('LOWER(request.location) LIKE :loc', {
        loc: `%${params.location.toLowerCase()}%`,
      });

    const [items, total] = await qb
      .orderBy('request.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getResourceRequestById(id: string): Promise<ResourceRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Yêu cầu nguồn lực không tồn tại');
    return request;
  }

  async createResourceRequest(data: CreateResourceRequestDto): Promise<ResourceRequest> {
    return this.requestRepo.save(
      this.requestRepo.create({
        ...data,
        urgency: data.urgency || RequestUrgency.MEDIUM,
        preferred_min_condition: Number(data.preferred_min_condition) || 0,
        status: RequestStatus.OPEN,
      }),
    );
  }

  // ── MATCHES ─────────────────────────────────────────────────────────────────

  async getResourceMatches(params: {
    resource_id?: string;
    request_id?: string;
    status?: string;
  }): Promise<any[]> {
    const qb = this.matchRepo.createQueryBuilder('match');
    if (params.resource_id) qb.andWhere('match.resource_id = :rid', { rid: params.resource_id });
    if (params.request_id) qb.andWhere('match.request_id = :rid', { rid: params.request_id });
    if (params.status) qb.andWhere('match.status = :s', { s: params.status });
    return qb.orderBy('match.created_at', 'DESC').getMany();
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  MATCH: SQLite pre-filter + scoring + AI ranking + greedy scheduling
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * Ghép nối resource (cung) ↔ request (cầu) bằng AI.
   *
   * Flow (2 layers + scheduler):
   *   1. **SQLite pre-filter** — chỉ giữ các cặp resource×request có:
   *      - resource.status = available  ∧  request.status = open
   *      - resource.type = request.need_type
   *      - resource.condition >= request.preferred_min_condition
   *      - region filter (nếu có)
   *      Giới hạn tối đa MAX_PAIRS_TO_LLM (15) để tránh tràn token.
   *   2. **Scoring** (SQLite layer) — điểm sơ bộ bằng:
   *      proximity (40%) + need_level/urgency (25%) + resource_condition (25%)
   *      + availability (10%).
   *   3. **AI ranking** — gửi danh sách đã lọc + scoring sang
   *      POST /api/ai/resource-exchange/match-rank để LLM xếp hạng, chấm điểm
   *      lại, giải thích tại sao phù hợp, và greedy-đưa ra **transport_plan**
   *      (lịch giao nhận) tránh xung đột thời gian.
   *   4. **Lưu kết quả** — lưu mỗi match vào bảng resource_matches.
   *
   * Nếu ai-service không khả dụng, trả về kết quả rỗng với degraded=true
   * (không bao giờ crash — graceful degradation).
   */
  async matchResources(params: ResourceMatchRankDto): Promise<MatchResourcesResponse> {
    const maxPairs = Math.min(
      ResourceMatchService.MAX_PAIRS_TO_LLM,
      Number(params.max_results) || ResourceMatchService.MAX_PAIRS_TO_LLM,
    );

    // 1. Fetch available resources + open requests
    const resources = await this.resourceRepo
      .createQueryBuilder('resource')
      .where('resource.status = :status', { status: ResourceStatus.AVAILABLE })
      .orderBy('resource.created_at', 'DESC')
      .limit(200)
      .getMany();

    const requests = await this.requestRepo
      .createQueryBuilder('request')
      .where('request.status = :status', { status: RequestStatus.OPEN })
      .orderBy('request.created_at', 'DESC')
      .limit(200)
      .getMany();

    // 2. Build candidate pairs (pre-filter + scoring)
    const region = params.region?.toLowerCase().trim() || '';
    const reqType = params.type?.toLowerCase().trim() || '';
    const pairs: ScoredPair[] = [];

    for (const req of requests) {
      if (reqType && req.need_type !== reqType) continue;
      if (region) {
        const rLoc = (req.location || '').toLowerCase();
        if (rLoc && !rLoc.includes(region)) continue;
      }

      for (const res of resources) {
        // Type must match (book↔book, device↔device, volunteer_hours↔volunteer_hours)
        if (res.type !== req.need_type) continue;
        // Resource condition must satisfy request minimum
        if (Number(res.condition) < Number(req.preferred_min_condition)) continue;

        const score = this._scorePair(res, req);

        pairs.push({
          resource_id: res.id,
          request_id: req.id,
          match_score: score,
          match_reasons: this._scoreReasons(res, req, score),
          resource: this._denormResource(res),
          request: this._denormRequest(req),
        });
      }
    }

    // 3. Sort by score (desc) and cap
    pairs.sort((a, b) => b.match_score - a.match_score);
    const limitedPairs = pairs.slice(0, maxPairs);

    this.logger.log(
      `[ResourceExchange] pre-filter: resources=${resources.length}, requests=${requests.length}, ` +
        `candidate_pairs=${pairs.length}, sent_to_llm=${limitedPairs.length}`,
    );

    if (limitedPairs.length === 0) {
      return {
        ranked_matches: [],
        pre_filter_summary: {
          total_resources: resources.length,
          total_requests: requests.length,
          pre_filtered_pairs: 0,
          max_pairs: maxPairs,
        },
        degraded: false,
      };
    }

    // 4. Send to ai-service for LLM ranking + transport scheduling
    try {
      const aiResult = await this.aiService.resourceExchangeMatchRank({
        pairs: limitedPairs,
        region: params.region,
        type: params.type,
        max_results: params.max_results,
      });

      // 5. Persist matches (fire-and-forget: DB failure must not break response)
      const ranked = aiResult?.ranked_matches || [];
      this._persistMatches(ranked, limitedPairs).catch((err: any) =>
        this.logger.warn(`Failed to persist resource_exchange matches: ${err?.message}`),
      );

      return {
        ranked_matches: ranked,
        pre_filter_summary: {
          total_resources: resources.length,
          total_requests: requests.length,
          pre_filtered_pairs: pairs.length,
          max_pairs: limitedPairs.length,
        },
        transport_plan: aiResult?.transport_plan,
        degraded: aiResult?.degraded || false,
        reason: aiResult?.reason,
      };
    } catch (error: any) {
      // Graceful degradation: AI unavailable → report without crashing
      this.logger.warn(`ResourceExchange LLM ranking failed: ${error?.message || error}`);
      // Still return the SQLite-scored pairs so the UI is never empty
      const degradedPairs = limitedPairs.map((p) => ({
        resource_id: p.resource_id,
        request_id: p.request_id,
        match_score: p.match_score,
        explanation: p.match_reasons.join('; '),
        match_reasons: p.match_reasons,
        next_steps: ['Liên hệ người cung cấp qua contact_method để xác nhận.'],
      }));
      return {
        ranked_matches: degradedPairs,
        pre_filter_summary: {
          total_resources: resources.length,
          total_requests: requests.length,
          pre_filtered_pairs: pairs.length,
          max_pairs: limitedPairs.length,
        },
        degraded: true,
        reason: `AI service unavailable: ${error?.message || String(error)}`,
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Scoring helpers
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * Scoring: proximity (40%) + need_level (25%) + condition (25%) + availability (10%).
   * Returns a 0–100 score.
   */
  private _scorePair(resource: any, request: any): number {
    const urgencyW = URGENCY_WEIGHT[request.urgency || 'medium'] || 2;
    const needLevelScore = (urgencyW / 4) * 100; // 25–100 mapped to 0–100 scale → *0.25

    // Proximity: haversine distance; closer = higher score.
    const dist = this._haversineKm(
      Number(resource.lat),
      Number(resource.lng),
      Number(request.lat),
      Number(request.lng),
    );
    const proximityScore = Math.max(0, 100 - dist); // 0 km → 100, 100km → 0

    // Condition: resource.condition / 5 * 100
    const condScore = Math.min(100, ((Number(resource.condition) || 0) / 5) * 100);

    // Availability: resource available before request deadline (binary bonus)
    let availScore = 100;
    if (request.deadline) {
      const avail = new Date(resource.available_from || Date.now()).getTime();
      const dl = new Date(request.deadline).getTime();
      availScore = avail <= dl ? 100 : 0;
    }

    const total =
      proximityScore * 0.4 + needLevelScore * 0.25 + condScore * 0.25 + availScore * 0.1;
    return Math.round(Math.max(0, Math.min(100, total)) * 10) / 10;
  }

  private _haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 50; // fallback: assume 50km if coords missing
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371; // Earth radius km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a)) || 0;
  }

  private _scoreReasons(_resource: any, _request: any, score: number): string[] {
    const reasons: string[] = [];
    if (score >= 80) reasons.push('Khoảng cách gần + nguồn lực đáp ứng đúng nhu cầu');
    else if (score >= 60) reasons.push('Nguồn lực phù hợp về loại và điều kiện');
    else reasons.push('Cặp này đáp ứng đủ điều kiện cơ bản');
    return reasons;
  }

  private _denormResource(r: any) {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      condition: Number(r.condition),
      location: r.location,
      lat: Number(r.lat),
      lng: Number(r.lng),
      available_from: r.available_from,
      cost: Number(r.cost),
      contact_method: r.contact_method,
      is_verified: r.is_verified,
      tags: r.tags,
    };
  }

  private _denormRequest(rq: any) {
    return {
      id: rq.id,
      title: rq.title,
      description: rq.description,
      need_type: rq.need_type,
      urgency: rq.urgency,
      location: rq.location,
      lat: Number(rq.lat),
      lng: Number(rq.lng),
      deadline: rq.deadline,
      preferred_min_condition: Number(rq.preferred_min_condition),
      contact_method: rq.contact_method,
      tags: rq.tags,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Persist matches (fire-and-forget, never throws to caller)
  // ════════════════════════════════════════════════════════════════════════════
  private async _persistMatches(ranked: any[], pairs: ScoredPair[]): Promise<void> {
    for (const m of ranked) {
      try {
        const resource = pairs.find((p) => p.resource_id === m.resource_id)?.resource;
        const request = pairs.find((p) => p.request_id === m.request_id)?.request;
        const plan = m.transport_plan || m.scheduled_pickup;
        await this.matchRepo.save(
          this.matchRepo.create({
            resource_id: m.resource_id,
            request_id: m.request_id,
            match_score: Number(m.match_score),
            explanation: m.explanation,
            status: MatchStatus.PENDING,
            scheduled_pickup: m.scheduled_pickup || null,
            transport_plan: plan ? JSON.stringify(plan) : null,
            created_by: resource?.contact_method || request?.contact_method || null,
          }),
        );
      } catch (err: any) {
        // Non-fatal: log and continue with next match
        this.logger.warn(`Could not persist one match: ${err?.message}`);
      }
    }
  }
}
