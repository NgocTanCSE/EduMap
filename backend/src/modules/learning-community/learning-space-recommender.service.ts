import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningSpot } from './entities/learning-spot.entity';
import { AIService } from '../ai/ai.service';
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
    radius?: number;
    has_wifi?: boolean;
    min_rating?: number;
    quietness_min?: number;
    open_now?: boolean;
    limit?: number;
    w_distance?: number;
    w_rating?: number;
    w_wifi?: number;
    w_quietness?: number;
    w_open_now?: number;
    w_capacity?: number;
}
export interface CriterionBreakdown {
    distance: number;
    rating: number;
    wifi: number;
    quietness: number;
    open_now: number;
    capacity: number;
}
export interface ScoredSpot {
    spot: any;
    score: number;
    distance_km: number;
    open_now: boolean;
    ranking_reason: string;
    matching_criteria: CriterionBreakdown;
    explanation?: string;
}
export interface RecommendResponse {
    spots: ScoredSpot[];
    total: number;
    center: {
        lat: number;
        lng: number;
    };
    radius_km: number;
    degraded?: boolean;
    reason?: string;
}
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
    @InjectRepository(LearningSpot)
    private readonly spotRepo: Repository<LearningSpot>, private readonly aiService: AIService) { }
    defaultWeights(): ScoringWeights {
        return { ...this.DEFAULT_WEIGHTS };
    }
    haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    isOpenNow(hours: Record<string, string | null> | string | null | undefined): boolean {
        if (!hours)
            return false;
        let h: Record<string, string | null>;
        if (typeof hours === 'string') {
            try {
                h = JSON.parse(hours);
            }
            catch {
                return false;
            }
        }
        else {
            h = hours;
        }
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const now = new Date();
        const dayName = days[now.getDay()];
        const today = h[dayName];
        if (!today)
            return false;
        const parts = today.split('-');
        if (parts.length !== 2)
            return false;
        const [oh, om] = parts[0].split(':').map(Number);
        const [ch, cm] = parts[1].split(':').map(Number);
        const openMin = oh * 60 + om;
        const closeMin = ch * 60 + cm;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        return nowMin >= openMin && nowMin <= closeMin;
    }
    private extractLatLng(location: any): [
        number,
        number
    ] | null {
        if (!location)
            return null;
        try {
            const loc = typeof location === 'string' ? JSON.parse(location) : location;
            if (loc?.type === 'Point' && Array.isArray(loc?.coordinates)) {
                const [lng, lat] = loc.coordinates;
                return [Number(lat), Number(lng)];
            }
        }
        catch {
            return null;
        }
        return null;
    }
    scoreSpot(spot: LearningSpot, userLat: number, userLng: number, radiusKm: number, weights: ScoringWeights): ScoredSpot {
        const ll = this.extractLatLng(spot.location);
        const spotLat = ll?.[0];
        const spotLng = ll?.[1];
        const distanceKm = spotLat !== undefined && spotLng !== undefined
            ? this.haversineDistance(userLat, userLng, spotLat, spotLng)
            : radiusKm + 1;
        const distanceNorm = Math.max(0, 1 - distanceKm / radiusKm);
        const ratingNorm = Math.max(0, Math.min(1, Number(spot.rating_avg || 0) / 5));
        const wifiNorm = spot.has_wifi ? 1 : 0;
        const quietnessNorm = spot.quietness != null ? Math.max(0, Math.min(1, spot.quietness / 5)) : 0.5;
        const openNorm = this.isOpenNow(spot.opening_hours) ? 1 : 0;
        const capacityNorm = Math.max(0, Math.min(1, Number(spot.total_capacity || 0) / 500));
        const criteria: CriterionBreakdown = {
            distance: +distanceNorm.toFixed(3),
            rating: +ratingNorm.toFixed(3),
            wifi: wifiNorm,
            quietness: +quietnessNorm.toFixed(3),
            open_now: openNorm,
            capacity: +capacityNorm.toFixed(3),
        };
        const score = weights.distance * distanceNorm +
            weights.rating * ratingNorm +
            weights.wifi * wifiNorm +
            weights.quietness * quietnessNorm +
            weights.open_now * openNorm +
            weights.capacity * capacityNorm;
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
    private resolveWeights(partial?: Partial<ScoringWeights>): ScoringWeights {
        const w = { ...this.DEFAULT_WEIGHTS, ...(partial || {}) };
        const total = w.distance + w.rating + w.wifi + w.quietness + w.open_now + w.capacity;
        if (total > 0 && total !== 1) {
            const f = 1 / total;
            w.distance *= f;
            w.rating *= f;
            w.wifi *= f;
            w.quietness *= f;
            w.open_now *= f;
            w.capacity *= f;
        }
        return w;
    }
    async recommend(options: RecommendOptions): Promise<RecommendResponse> {
        const { lat, lng, radius = 5000, has_wifi, min_rating, quietness_min, open_now: openNowFilter, limit = 20, w_distance, w_rating, w_wifi, w_quietness, w_open_now, w_capacity, } = options;
        if (lat == null || lng == null) {
            throw new Error('lat và lng là bắt buộc');
        }
        const radiusKm = radius / 1000;
        const rawWeights = {
            distance: w_distance, rating: w_rating, wifi: w_wifi,
            quietness: w_quietness, open_now: w_open_now, capacity: w_capacity,
        };
        const weightOverrides: Partial<ScoringWeights> = {};
        for (const [k, v] of Object.entries(rawWeights)) {
            if (v !== undefined)
                (weightOverrides as any)[k] = v;
        }
        const weights = this.resolveWeights(weightOverrides);
        const allSpots = await this.spotRepo.find();
        const scored: ScoredSpot[] = [];
        for (const spot of allSpots) {
            const ll = this.extractLatLng(spot.location);
            if (!ll)
                continue;
            const dist = this.haversineDistance(lat, lng, ll[0], ll[1]);
            const distMeters = dist * 1000;
            if (distMeters > radius)
                continue;
            if (has_wifi === true && !spot.has_wifi)
                continue;
            if (min_rating != null && Number(spot.rating_avg || 0) < min_rating)
                continue;
            if (quietness_min != null && (spot.quietness == null || spot.quietness < quietness_min))
                continue;
            if (openNowFilter === true && !this.isOpenNow(spot.opening_hours))
                continue;
            scored.push(this.scoreSpot(spot, lat, lng, radiusKm, weights));
        }
        scored.sort((a, b) => b.score - a.score);
        const result = scored.slice(0, limit);
        let degraded = false;
        let reason: string | undefined;
        const topForExplain = result.slice(0, limit);
        const explainPromises = topForExplain.map(async (scored) => {
            if (!this.aiService)
                return scored;
            try {
                const aiResult = await this.aiService.explainLearningSpace({
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
                }, { distance_km: scored.distance_km, weights, radius_km: radiusKm });
                if (aiResult?.explanation) {
                    scored.explanation = aiResult.explanation;
                    if (aiResult.degraded) {
                        degraded = true;
                        reason = aiResult.reason || reason;
                    }
                }
            }
            catch {
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
