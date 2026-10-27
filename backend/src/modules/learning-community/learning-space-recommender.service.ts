import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningSpot } from './entities/learning-spot.entity';
import { AIService } from '../ai/ai.service';

/**
 * Weights for each scoring criterion. Must sum to 1.0 so the final
 * score lands in [0, 100]. Callers may override individual weights to
 * re-rank by preference (e.g. "quiet-first" mode).
 */
export interface ScoringWeights {
  distance: number;
  rating: number;
  wifi: number;
  quietness: number;
  open_now: number;
  capacity: number;
}

export interface RecommendOptions {
  lat: number;
  lng: number;
  radius?: number;          // meters; default 5000
  has_wifi?: boolean;
  min_rating?: number;      // 0–5
  quietness_min?: number;   // 1–5
  open_now?: boolean;
  limit?: number;           // default 20
  // Flat weight overrides (auto-normalised). Map to ScoringWeights internally.
  w_distance?: number;
  w_rating?: number;
  w_wifi?: number;
  w_quietness?: number;
  w_open_now?: number;
  w_capacity?: number;
}

export interface CriterionBreakdown {
  distance: number;   // [0,1]
  rating: number;     // [0,1]
  wifi: number;       // [0,1]
  quietness: number;  // [0,1]
  open_now: number;   // [0,1]
  capacity: number;   // [0,1]
}

export interface ScoredSpot {
  spot: any;
  score: number;            // 0–100
  distance_km: number;
  open_now: boolean;
  ranking_reason: string;
  matching_criteria: CriterionBreakdown;
  explanation?: string;     // from AI service (may be absent on degrade)
}

export interface RecommendResponse {
  spots: ScoredSpot[];
  total: number;
  center: { lat: number; lng: number };
  radius_km: number;
  degraded?: boolean;
  reason?: string;
}

/**
 * AI Learning Space Recommender (Idea #13).
 *
 * Ranks study spots by normalised, weighted criteria so no single factor
 * (notably distance) can dominate the ranking. Explanations are fetched from
 * the AI service with a 24-hour cache (handled server-side in the AI
 * service) and degrade gracefully to a static template when the AI service
 * is unavailable.
 */
@Injectable()
export class LearningSpaceRecommenderService {
  private readonly logger = new Logger(LearningSpaceRecommenderService.name);

  private readonly DEFAULT_WEIGHTS: ScoringWeights = {
    distance: 0.35,
    rating: 0.20,
    wifi: 0.10,
    quietness: 0.15,
    open_now: 0.10,
    capacity: 0.10,
  };

  constructor(
    @InjectRepository(LearningSpot) private readonly spotRepo: Repository<LearningSpot>,
    private readonly aiService: AIService,
  ) {}

  /** Default weights (defensive copy so callers can't mutate internals). */
  defaultWeights(): ScoringWeights {
    return { ...this.DEFAULT_WEIGHTS };
  }

  // ─── Pure helpers (no DI — unit-testable) ─────────────────────────────

  /** Haversine distance in kilometres between two lat/lng points. */
  haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check whether a spot is currently open based on its opening_hours JSON.
   * Format: { "monday": "08:00-17:30", ..., "sunday": null }
   * null / missing hour = closed that day.
   */
  isOpenNow(hours: Record<string, string | null> | string | null | undefined): boolean {
    if (!hours) return false;
    let h: Record<string, string | null>;
    if (typeof hours === 'string') {
      try {
        h = JSON.parse(hours);
      } catch {
        return false;
      }
    } else {
      h = hours;
    }
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const today = h[dayName];
    if (!today) return false;

    const parts = today.split('-');
    if (parts.length !== 2) return false;
    const [oh, om] = parts[0].split(':').map(Number);
    const [ch, cm] = parts[1].split(':').map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin >= openMin && nowMin <= closeMin;
  }

  /** Extract [lat, lng] from a GeoJSON Point stored as JSON or string. */
  private extractLatLng(location: any): [number, number] | null {
    if (!location) return null;
    try {
      const loc = typeof location === 'string' ? JSON.parse(location) : location;
      if (loc?.type === 'Point' && Array.isArray(loc?.coordinates)) {
        const [lng, lat] = loc.coordinates;
        return [Number(lat), Number(lng)];
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Pure scoring function: returns a 0–100 score plus the per-criterion
   * breakdown. No DB or HTTP access — fully deterministic for test input.
   */
  scoreSpot(
    spot: LearningSpot,
    userLat: number,
    userLng: number,
    radiusKm: number,
    weights: ScoringWeights,
  ): ScoredSpot {
    const ll = this.extractLatLng(spot.location);
    const spotLat = ll?.[0];
    const spotLng = ll?.[1];
    const distanceKm =
      spotLat !== undefined && spotLng !== undefined
        ? this.haversineDistance(userLat, userLng, spotLat, spotLng)
        : radiusKm + 1; // penalise spots without coordinates

    // ── Normalise each criterion to [0, 1] ───────────────────────────
    const distanceNorm = Math.max(0, 1 - distanceKm / radiusKm);
    const ratingNorm = Math.max(0, Math.min(1, Number(spot.rating_avg || 0) / 5));
    const wifiNorm = spot.has_wifi ? 1 : 0;
    // quietness: NULL → neutral 0.5 (don't penalise unknown)
    const quietnessNorm =
      spot.quietness != null ? Math.max(0, Math.min(1, spot.quietness / 5)) : 0.5;
    const openNorm = this.isOpenNow(spot.opening_hours) ? 1 : 0;
    // capacity: relative to a 500-seat ceiling, clamped
    const capacityNorm = Math.max(0, Math.min(1, Number(spot.total_capacity || 0) / 500));

    const criteria: CriterionBreakdown = {
      distance: +distanceNorm.toFixed(3),
      rating: +ratingNorm.toFixed(3),
      wifi: wifiNorm,
      quietness: +quietnessNorm.toFixed(3),
      open_now: openNorm,
      capacity: +capacityNorm.toFixed(3),
    };

    const score =
      weights.distance * distanceNorm +
      weights.rating * ratingNorm +
      weights.wifi * wifiNorm +
      weights.quietness * quietnessNorm +
      weights.open_now * openNorm +
      weights.capacity * capacityNorm;

    // Build a human-readable ranking reason from the top contributors
    const topReasons = Object.entries(criteria)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => this.criterionLabel(k));

    return {
      spot,
      score: Math.round(score * 100),
      distance_km: +distanceKm.toFixed(2),
      open_now: openNorm === 1,
      ranking_reason: topReasons.join(', '),
      matching_criteria: criteria,
    };
  }

  private criterionLabel(key: string): string {
    const labels: Record<string, string> = {
      distance: 'gần',
      rating: 'đánh giá',
      wifi: 'wifi',
      quietness: 'yên tĩnh',
      open_now: 'đang mở',
      capacity: 'sức chứa',
    };
    return labels[key] || key;
  }

  /** Merge caller-supplied weight overrides onto defaults (normalised). */
  private resolveWeights(partial?: Partial<ScoringWeights>): ScoringWeights {
    const w = { ...this.DEFAULT_WEIGHTS, ...(partial || {}) };
    const total = w.distance + w.rating + w.wifi + w.quietness + w.open_now + w.capacity;
    if (total > 0 && total !== 1) {
      const f = 1 / total;
      w.distance *= f; w.rating *= f; w.wifi *= f;
      w.quietness *= f; w.open_now *= f; w.capacity *= f;
    }
    return w;
  }

  // ─── Public API ─────────────────────────────────────────────────────

  /**
   * Recommend learning spaces ranked by normalised weighted score.
   * Fetches AI explanations (graceful degrade on failure).
   */
  async recommend(options: RecommendOptions): Promise<RecommendResponse> {
    const {
      lat, lng,
      radius = 5000,
      has_wifi,
      min_rating,
      quietness_min,
      open_now: openNowFilter,
      limit = 20,
      w_distance, w_rating, w_wifi, w_quietness, w_open_now, w_capacity,
    } = options;

    if (lat == null || lng == null) {
      throw new Error('lat và lng là bắt buộc');
    }

    const radiusKm = radius / 1000;
    const rawWeights = {
      distance: w_distance, rating: w_rating, wifi: w_wifi,
      quietness: w_quietness, open_now: w_open_now, capacity: w_capacity,
    };
    // Drop undefined so defaults survive the spread merge
    const weightOverrides: Partial<ScoringWeights> = {};
    for (const [k, v] of Object.entries(rawWeights)) {
      if (v !== undefined) (weightOverrides as any)[k] = v;
    }
    const weights = this.resolveWeights(weightOverrides);

    // Fetch all spots — with the current curated dataset (~5 rows) a full
    // scan with haversine is negligible. For larger datasets, add a bounding-box
    // pre-filter; SQLite lacks ST_DWithin so distance is computed in JS.
    const allSpots = await this.spotRepo.find();

    // Apply filters + score
    const scored: ScoredSpot[] = [];
    for (const spot of allSpots) {
      const ll = this.extractLatLng(spot.location);
      if (!ll) continue;

      const dist = this.haversineDistance(lat, lng, ll[0], ll[1]);
      const distMeters = dist * 1000;

      // Filter: radius
      if (distMeters > radius) continue;
      // Filter: has_wifi
      if (has_wifi === true && !spot.has_wifi) continue;
      // Filter: min_rating
      if (min_rating != null && Number(spot.rating_avg || 0) < min_rating) continue;
      // Filter: quietness_min
      if (quietness_min != null && (spot.quietness == null || spot.quietness < quietness_min)) continue;
      // Filter: open_now
      if (openNowFilter === true && !this.isOpenNow(spot.opening_hours)) continue;

      scored.push(this.scoreSpot(spot, lat, lng, radiusKm, weights));
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const result = scored.slice(0, limit);

    // Fetch AI explanations for the top results (graceful degrade)
    let degraded = false;
    let reason: string | undefined;

    const topForExplain = result.slice(0, limit);
    const explainPromises = topForExplain.map(async (scored) => {
      if (!this.aiService) return scored;
      try {
        const aiResult = await this.aiService.explainLearningSpace(
          {
            id: scored.spot.id,
            name: scored.spot.name,
            type: scored.spot.type,
            address: scored.spot.address,
            rating_avg: scored.spot.rating_avg,
            quietness: scored.spot.quietness,
            amenities: scored.spot.amenities,
            opening_hours: scored.spot.opening_hours,
            has_wifi: scored.spot.has_wifi,
            distance_km: scored.distance_km,
          },
          { distance_km: scored.distance_km, weights, radius_km: radiusKm },
        );
        if (aiResult?.explanation) {
          scored.explanation = aiResult.explanation;
          if (aiResult.degraded) {
            degraded = true;
            reason = aiResult.reason || reason;
          }
        }
      } catch {
        degraded = true;
        reason = 'AI giải thích không khả dụng — hiển thị lý do xếp hạng tĩnh.';
      }
      return scored;
    });

    const withExplanations = await Promise.all(explainPromises);

    if (withExplanations.length > 0 && withExplanations.every((s) => !s.explanation)) {
      degraded = true;
      reason = 'AI service không khả dụng — sử dụng lý do xếp hạng tĩnh.';
    }

    return {
      spots: withExplanations,
      total: scored.length,
      center: { lat, lng },
      radius_km: radiusKm,
      degraded,
      reason,
    };
  }
}
