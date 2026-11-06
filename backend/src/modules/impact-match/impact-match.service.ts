import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SponsorNeed, NeedStatus, NeedUrgency } from './entities/sponsor-need.entity';
import { SponsorProfile, SponsorStatus } from './entities/sponsor-profile.entity';
import { AIService } from '../ai/ai.service';
import { CreateSponsorNeedDto } from './dto/create-sponsor-need.dto';
import { CreateSponsorProfileDto } from './dto/create-sponsor-profile.dto';
import { ImpactMatchRankDto } from './dto/impact-match-rank.dto';
export interface MatchResult {
    need_id: string;
    sponsor_id: string;
    match_score: number;
    match_reasons: string[];
    next_steps: string[];
    need?: {
        id: string;
        title: string;
        category: string;
        urgency: string;
        cost_estimate: number;
        location: string;
        description: string;
    };
    sponsor?: {
        id: string;
        name: string;
        focus_areas: string[];
        budget_amount: number;
        location: string;
        description: string;
    };
}
export interface RankMatchesResponse {
    ranked_matches: MatchResult[];
    pre_filter_summary: {
        total_needs: number;
        total_sponsors: number;
        pre_filtered_pairs: number;
        max_pairs: number;
    };
    degraded: boolean;
    reason?: string;
}
@Injectable()
export class ImpactMatchService {
    private readonly logger = new Logger(ImpactMatchService.name);
    private static readonly MAX_PAIRS_TO_LLM = 15;
    constructor(
    @InjectRepository(SponsorNeed)
    private readonly needRepo: Repository<SponsorNeed>, 
    @InjectRepository(SponsorProfile)
    private readonly sponsorRepo: Repository<SponsorProfile>, private readonly aiService: AIService) { }
    async getCachedRankings(refresh?: boolean): Promise<any> {
        return this.aiService.getCachedImpactMatchRankings(refresh);
    }
    async getSponsorNeeds(params: {
        page?: number;
        limit?: number;
        category?: string;
        status?: string;
        location?: string;
        urgency?: string;
    }): Promise<{
        items: SponsorNeed[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
        const skip = (page - 1) * limit;
        const qb = this.needRepo
            .createQueryBuilder('need')
            .where('need.deleted_at IS NULL')
            .andWhere('need.status != :closed', { closed: NeedStatus.CLOSED });
        if (params.category)
            qb.andWhere('LOWER(need.category) = :cat', { cat: params.category.toLowerCase() });
        if (params.status)
            qb.andWhere('LOWER(need.status) = :status', { status: params.status.toLowerCase() });
        if (params.urgency)
            qb.andWhere('LOWER(need.urgency) = :urgency', { urgency: params.urgency.toLowerCase() });
        if (params.location)
            qb.andWhere('LOWER(need.location) LIKE :loc', { loc: `%${params.location.toLowerCase()}%` });
        const [items, total] = await qb
            .orderBy('need.created_at', 'DESC')
            .skip(skip).take(limit)
            .getManyAndCount();
        return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
    async getSponsorProfiles(params: {
        page?: number;
        limit?: number;
        focus_area?: string;
        location?: string;
        is_verified?: boolean;
    }): Promise<{
        items: SponsorProfile[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
        const skip = (page - 1) * limit;
        const qb = this.sponsorRepo
            .createQueryBuilder('sponsor')
            .where('sponsor.status = :status', { status: SponsorStatus.ACTIVE });
        if (params.is_verified !== undefined)
            qb.andWhere('sponsor.is_verified = :v', { v: params.is_verified });
        if (params.location)
            qb.andWhere('LOWER(sponsor.location) LIKE :loc', { loc: `%${params.location.toLowerCase()}%` });
        if (params.focus_area) {
            qb.andWhere('LOWER(sponsor.focus_areas) LIKE :fa', { fa: `%${params.focus_area.toLowerCase()}%` });
        }
        const [items, total] = await qb
            .orderBy('sponsor.budget_amount', 'DESC')
            .skip(skip).take(limit)
            .getManyAndCount();
        return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
    async getSponsorNeedById(id: string): Promise<SponsorNeed> {
        const need = await this.needRepo.findOne({ where: { id, deleted_at: null as any } });
        if (!need)
            throw new NotFoundException('Nhu cầu không tồn tại');
        return need;
    }
    async getSponsorProfileById(id: string): Promise<SponsorProfile> {
        const sponsor = await this.sponsorRepo.findOne({ where: { id } });
        if (!sponsor)
            throw new NotFoundException('Nhà tài trợ không tồn tại');
        return sponsor;
    }
    async createSponsorNeed(data: CreateSponsorNeedDto): Promise<SponsorNeed> {
        const need = this.needRepo.create({
            ...data,
            tags: data.tags || [],
            status: NeedStatus.OPEN,
            urgency: data.urgency || NeedUrgency.MEDIUM,
            cost_estimate: Number(data.cost_estimate) || 0,
        });
        return this.needRepo.save(need);
    }
    async createSponsorProfile(data: CreateSponsorProfileDto): Promise<SponsorProfile> {
        const sponsor = this.sponsorRepo.create({
            ...data,
            focus_areas: data.focus_areas || [],
            budget_amount: Number(data.budget_amount) || 0,
            budget_currency: data.budget_currency || 'VND',
            status: data.status || SponsorStatus.ACTIVE,
            is_verified: data.is_verified ?? false,
        });
        return this.sponsorRepo.save(sponsor);
    }
    async rankMatches(params: ImpactMatchRankDto): Promise<RankMatchesResponse> {
        const maxPairs = Math.min(ImpactMatchService.MAX_PAIRS_TO_LLM, Number(params.max_results) || ImpactMatchService.MAX_PAIRS_TO_LLM);
        const needs = await this.needRepo
            .createQueryBuilder('need')
            .where('need.deleted_at IS NULL')
            .andWhere('need.status = :status', { status: NeedStatus.OPEN })
            .orderBy('need.created_at', 'DESC')
            .limit(params.max_cost ? 200 : 50)
            .getMany();
        const sponsors = await this.sponsorRepo
            .createQueryBuilder('sponsor')
            .where('sponsor.status = :status', { status: SponsorStatus.ACTIVE })
            .orderBy('sponsor.budget_amount', 'DESC')
            .limit(50)
            .getMany();
        const region = params.region?.toLowerCase().trim() || '';
        const pairs: any[] = [];
        for (const need of needs) {
            if (params.category && need.category !== params.category)
                continue;
            if (params.max_cost && Number(need.cost_estimate) > params.max_cost)
                continue;
            for (const sponsor of sponsors) {
                if (Number(sponsor.budget_amount) < Number(need.cost_estimate))
                    continue;
                if (region) {
                    const needLoc = (need.location || '').toLowerCase();
                    if (needLoc && !needLoc.includes(region))
                        continue;
                }
                const focusAreas = Array.isArray(sponsor.focus_areas) ? sponsor.focus_areas : JSON.parse(sponsor.focus_areas || '[]');
                const needTags = Array.isArray(need.tags) ? need.tags : JSON.parse(need.tags || '[]');
                const categoryMatch = need.category && (focusAreas.some((fa: string) => fa === need.category) ||
                    needTags.some((t: string) => focusAreas.includes(t)));
                pairs.push({
                    need_id: need.id,
                    sponsor_id: sponsor.id,
                    need: {
                        id: need.id,
                        title: need.title,
                        description: need.description,
                        category: need.category,
                        urgency: need.urgency,
                        cost_estimate: Number(need.cost_estimate),
                        location: need.location,
                        tags: needTags,
                    },
                    sponsor: {
                        id: sponsor.id,
                        name: sponsor.name,
                        description: sponsor.description,
                        focus_areas: focusAreas,
                        budget_amount: Number(sponsor.budget_amount),
                        budget_currency: sponsor.budget_currency,
                        location: sponsor.location,
                    },
                    category_match: categoryMatch,
                });
            }
        }
        const limitedPairs = pairs.slice(0, maxPairs);
        this.logger.log(`[ImpactMatch] pre-filter: needs=${needs.length}, sponsors=${sponsors.length}, ` +
            `candidate_pairs=${pairs.length}, sent_to_llm=${limitedPairs.length}`);
        if (limitedPairs.length === 0) {
            return {
                ranked_matches: [],
                pre_filter_summary: {
                    total_needs: needs.length,
                    total_sponsors: sponsors.length,
                    pre_filtered_pairs: 0,
                    max_pairs: maxPairs,
                },
                degraded: false,
            };
        }
        try {
            const aiResult = await this.aiService.impactMatchRank({
                pairs: limitedPairs,
                region: params.region,
                category: params.category,
                max_results: params.max_results,
            });
            return {
                ranked_matches: (aiResult?.ranked_matches || []).map((m: any) => ({
                    need_id: m.need_id,
                    sponsor_id: m.sponsor_id,
                    match_score: m.match_score,
                    match_reasons: m.match_reasons || [],
                    next_steps: m.next_steps || [],
                    need: limitedPairs.find(p => p.need_id === m.need_id)?.need,
                    sponsor: limitedPairs.find(p => p.sponsor_id === m.sponsor_id)?.sponsor,
                })),
                pre_filter_summary: {
                    total_needs: needs.length,
                    total_sponsors: sponsors.length,
                    pre_filtered_pairs: pairs.length,
                    max_pairs: limitedPairs.length,
                },
                degraded: aiResult?.degraded || false,
                reason: aiResult?.reason,
            };
        }
        catch (error: any) {
            this.logger.warn(`ImpactMatch LLM ranking failed: ${error?.message || error}`);
            return {
                ranked_matches: [],
                pre_filter_summary: {
                    total_needs: needs.length,
                    total_sponsors: sponsors.length,
                    pre_filtered_pairs: pairs.length,
                    max_pairs: limitedPairs.length,
                },
                degraded: true,
                reason: `AI service unavailable: ${error?.message || String(error)}`,
            };
        }
    }
}
