import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from './entities/opportunity.entity';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Job } from '../career/entities/job.entity';
import { User } from '../auth/entities/user.entity';
import { AIService } from '../ai/ai.service';
export interface MatchOptions {
    limit?: number;
    type?: string;
    field?: string;
}
export interface UserProfile {
    id: string;
    full_name: string;
    major: string;
    skills: string[];
    interests: string[];
    location: string;
    role: string;
    gpa?: number | null;
}
export interface NormalizedOpportunity {
    id: string;
    title: string;
    description: string;
    type: string;
    organization: string;
    requirements: string;
    benefits: string;
    url: string;
    field_tags: string[];
    region: string;
    deadline: string | null;
    source_table: string;
    status: string;
}
@Injectable()
export class OpportunityMatchingService {
    private readonly logger = new Logger(OpportunityMatchingService.name);
    private readonly DEFAULT_LIMIT = 30;
    constructor(
    @InjectRepository(Opportunity)
    private readonly oppRepo: Repository<Opportunity>, 
    @InjectRepository(Scholarship)
    private readonly scholarRepo: Repository<Scholarship>, 
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>, 
    @InjectRepository(User)
    private readonly userRepo: Repository<User>, private readonly aiService: AIService) { }
    async getUserProfile(userId: string): Promise<UserProfile> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new NotFoundException('Người dùng không tồn tại');
        return {
            id: user.id,
            full_name: user.full_name || '',
            major: user.major || '',
            skills: user.skills || [],
            interests: user.interests || [],
            location: user.location || '',
            role: user.role,
            gpa: null,
        };
    }
    async preFilterOpportunities(options?: MatchOptions): Promise<NormalizedOpportunity[]> {
        const now = new Date();
        const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, 60);
        const field = options?.field?.trim();
        const typeFilter = options?.type?.trim();
        const hasField = !!field;
        const hasType = !!typeFilter;
        const oppQb = this.oppRepo.createQueryBuilder('opp')
            .where('opp.deleted_at IS NULL')
            .andWhere('opp.status = :status', { status: 'active' })
            .andWhere('(opp.deadline IS NULL OR opp.deadline > :now)', { now })
            .orderBy('opp.created_at', 'DESC')
            .limit(limit);
        if (hasType) {
            oppQb.andWhere('LOWER(opp.type) = LOWER(:type)', { type: typeFilter });
        }
        if (hasField) {
            const f = `%${field}%`;
            oppQb.andWhere('(LOWER(opp.title) LIKE LOWER(:f) OR LOWER(opp.description) LIKE LOWER(:f) '
                + 'OR LOWER(opp.requirements) LIKE LOWER(:f) OR LOWER(opp.organization) LIKE LOWER(:f) '
                + 'OR LOWER(opp.region) LIKE LOWER(:f))', { f });
        }
        const scholarQb = this.scholarRepo.createQueryBuilder('sch')
            .where('sch.deleted_at IS NULL')
            .andWhere('sch.status = :status', { status: 'active' })
            .andWhere('(sch.deadline IS NULL OR sch.deadline > :now)', { now })
            .orderBy('sch.created_at', 'DESC')
            .limit(limit);
        if (hasField) {
            const f = `%${field}%`;
            scholarQb.andWhere('(LOWER(sch.title) LIKE LOWER(:f) OR LOWER(sch.description) LIKE LOWER(:f) '
                + 'OR LOWER(sch.provider) LIKE LOWER(:f))', { f });
        }
        const jobQb = this.jobRepo.createQueryBuilder('job')
            .where('job.status = :status', { status: 'active' })
            .andWhere('(job.application_deadline IS NULL OR job.application_deadline > :now)', { now })
            .orderBy('job.created_at', 'DESC')
            .limit(limit);
        if (hasField) {
            const f = `%${field}%`;
            jobQb.andWhere('(LOWER(job.title) LIKE LOWER(:f) OR LOWER(job.description) LIKE LOWER(:f) '
                + 'OR LOWER(job.company_name) LIKE LOWER(:f))', { f });
        }
        const [oppRows, scholarRows, jobRows] = await Promise.all([
            oppQb.getRawMany(),
            scholarQb.getRawMany(),
            jobQb.getRawMany(),
        ]);
        const candidates: NormalizedOpportunity[] = [];
        const parseJson = (val: any): string[] => {
            if (!val)
                return [];
            if (Array.isArray(val))
                return val.map(String);
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
            }
            catch {
                return String(val).split(',').map((s) => s.trim()).filter(Boolean);
            }
        };
        for (const r of oppRows) {
            const tags = parseJson(r.field_tags);
            candidates.push({
                id: r.id,
                title: r.title,
                description: r.description || '',
                type: r.type || 'other',
                organization: r.organization || '',
                requirements: r.requirements || '',
                benefits: r.benefits || '',
                url: r.url || '',
                field_tags: tags,
                region: r.region || '',
                deadline: r.deadline ? new Date(r.deadline).toISOString() : null,
                source_table: 'opportunities',
                status: r.status || 'active',
            });
        }
        for (const r of scholarRows) {
            const crit = parseJson(r.eligibility_criteria);
            candidates.push({
                id: r.id,
                title: r.title,
                description: r.description || '',
                type: 'scholarship',
                organization: r.provider || '',
                requirements: crit.join('; '),
                benefits: r.value_amount ? `${r.value_amount} USD` : '',
                url: r.apply_url || '',
                field_tags: crit,
                region: '',
                deadline: r.deadline ? new Date(r.deadline).toISOString() : null,
                source_table: 'scholarships',
                status: r.status || 'active',
            });
        }
        for (const r of jobRows) {
            const skills = parseJson(r.required_skills);
            candidates.push({
                id: r.id,
                title: r.title,
                description: r.description || '',
                type: r.job_type || 'job',
                organization: r.company_name || '',
                requirements: [...skills, r.experience_level || ''].filter(Boolean).join('; '),
                benefits: r.salary_range || '',
                url: '',
                field_tags: skills,
                region: r.location || '',
                deadline: r.application_deadline ? new Date(r.application_deadline).toISOString() : null,
                source_table: 'jobs',
                status: r.status || 'active',
            });
        }
        const filtered = hasType
            ? candidates.filter((c) => c.type.toLowerCase() === typeFilter.toLowerCase() || c.source_table === typeFilter)
            : candidates;
        return filtered.filter((c) => !c.deadline || new Date(c.deadline) > now);
    }
    async matchOpportunities(userId: string, options?: MatchOptions, profileOverrides?: Partial<UserProfile>): Promise<any> {
        const profile = { ...(await this.getUserProfile(userId)), ...(profileOverrides || {}) };
        const candidates = await this.preFilterOpportunities(options);
        this.logger.log(`[OpportunityRadar] pre-filtered ${candidates.length} candidates for user ${userId}`);
        try {
            const aiResult = await this.aiService.matchOpportunities({
                user_profile: profile,
                opportunities: candidates,
            });
            return aiResult;
        }
        catch (err: any) {
            this.logger.warn(`[OpportunityRadar] AI service unavailable, using keyword fallback: ${err.message}`);
            return this._keywordFallback(profile, candidates, String(err?.message || err));
        }
    }
    private _keywordFallback(profile: UserProfile, candidates: NormalizedOpportunity[], err: string) {
        const profileTerms = [profile.major, ...(profile.skills || []), ...(profile.interests || [])]
            .filter(Boolean)
            .map((t) => t.toLowerCase());
        const region = (profile.location || '').toLowerCase();
        const now = new Date();
        const matches = candidates
            .filter((c) => {
            if (c.deadline && new Date(c.deadline) <= now)
                return false;
            return true;
        })
            .map((c) => {
            const text = `${c.title} ${c.description} ${c.requirements} ${(c.field_tags || []).join(' ')} ${c.organization}`.toLowerCase();
            let score = 0;
            const reasons: string[] = [];
            for (const term of profileTerms) {
                if (term && text.includes(term)) {
                    score += 12;
                    if (reasons.length < 4)
                        reasons.push(`Khớp: ${term}`);
                }
            }
            if (region && (c.region.toLowerCase().includes(region) || text.includes(region))) {
                score += 15;
                if (reasons.length < 4)
                    reasons.push('Khu vực phù hợp');
            }
            score = Math.min(100, score);
            return {
                id: c.id,
                title: c.title,
                organization: c.organization,
                type: c.type,
                url: c.url || null,
                deadline: c.deadline,
                region: c.region,
                match_score: score,
                confidence: 0.3,
                confidence_level: 'low' as const,
                is_eligible: score >= 40,
                extracted_criteria: {},
                match_reasons: reasons.length ? reasons : ['Dựa trên từ khóa hồ sơ'],
                checklist: this._checklistFor(c, text),
                source_url: c.url || null,
            };
        })
            .sort((a, b) => b.match_score - a.match_score);
        return {
            user_id: profile.id,
            matches,
            total: matches.length,
            filtered_count: candidates.length - matches.length,
            degraded: true,
            reason: `AI unavailable — ${err.slice(0, 140)}`,
        };
    }
    private _checklistFor(c: NormalizedOpportunity, textLower: string): string[] {
        const list: string[] = ['Hồ sơ cá nhân / CV'];
        if (textLower.includes('điểm') || textLower.includes('gpa') || textLower.includes('xếp loại')) {
            list.push('Bảng điểm (GPA) / Bằng cấp');
        }
        if (textLower.includes('tiếng anh') || textLower.includes('ielts') || textLower.includes('toefl') || textLower.includes('ngoại ngữ')) {
            list.push('Chứng chỉ ngoại ngữ (IELTS/TOEFL/Tiếng Anh)');
        }
        if (textLower.includes('bài luận') || textLower.includes('personal statement') || textLower.includes('luận văn')) {
            list.push('Bài luận cá nhân');
        }
        if (textLower.includes('portfolio') || textLower.includes('dự án') || textLower.includes('project')) {
            list.push('Portfolio / dự án');
        }
        if (textLower.includes('thư giới thiệu') || textLower.includes('recommendation')) {
            list.push('Thư giới thiệu');
        }
        if (c.type === 'scholarship')
            list.push('Bản sao bằng cấp + Chứng nhận hành vi');
        return list;
    }
}
