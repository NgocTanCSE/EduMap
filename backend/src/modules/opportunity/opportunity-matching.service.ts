import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from './entities/opportunity.entity';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Job } from '../career/entities/job.entity';
import { User } from '../auth/entities/user.entity';
import { AIService } from '../ai/ai.service';

/**
 * Input a user supplies to steer the Opportunity Radar (scholarship / job /
 * competition). All fields optional — absent filters widen the net.
 */
export interface MatchOptions {
  limit?: number;
  type?: string;   // scholarship | internship | job | hackathon | competition | ...
  field?: string;  // free-text keyword (major, skill, tag...)
}

/**
 * A user profile distilled to the attributes the matcher needs. `gpa` is
 * populated by the caller (manual input or PDF-transcript extraction) and is
 * optional — many opportunities do not state a GPA requirement.
 */
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

/**
 * A single opportunity candidate normalised across the three backing tables
 * (opportunities, scholarships, jobs) so the AI service can reason about them
 * uniformly.
 */
export interface NormalizedOpportunity {
  id: string;
  title: string;
  description: string;
  type: string;          // scholarship | internship | job | hackathon | competition | ...
  organization: string;  // provider / company / organization
  requirements: string; // free-text eligibility / skill requirements
  benefits: string;     // free-text benefits / value / salary
  url: string;          // official application URL (provenance)
  field_tags: string[];
  region: string;
  deadline: string | null; // ISO date string or null (no deadline published)
  source_table: string;  // opportunities | scholarships | jobs
  status: string;
}

/**
 * T1 — Backend pre-filter + orchestration layer for the Opportunity Radar.
 *
 * Responsibilities:
 *  1. Read the user's academic profile (major, skills, interests, location).
 *  2. SQLite pre-filtering across `opportunities`, `scholarships` and `jobs`:
 *       - status = active/open
 *       - deadline > today  (or NULL => "check the official page")
 *       - deleted_at IS NULL (soft-deleted rows excluded)
 *       - optional type / field keyword narrow the candidate set
 *  3. Normalise candidates to a common shape.
 *  4. Proxy the candidates + profile to the AI service
 *     (POST /api/ai/opportunity/match, T2) for NLP criteria extraction +
 *     semantic scoring, then return the enriched result.
 *
 * On HF Spaces (DB_TYPE=sqlite) this service is the single source of truth
 * for SQLite data access — the AI service runs with db_service=None and does
 * NOT open its own DB connection.
 */
@Injectable()
export class OpportunityMatchingService {
  private readonly logger = new Logger(OpportunityMatchingService.name);

  // Upper bound on candidates handed to the LLM to keep the prompt within the
  // embedding/RAG timeout budget on the free HF Spaces plan.
  private readonly DEFAULT_LIMIT = 30;

  constructor(
    @InjectRepository(Opportunity) private readonly oppRepo: Repository<Opportunity>,
    @InjectRepository(Scholarship) private readonly scholarRepo: Repository<Scholarship>,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly aiService: AIService,
  ) {}

  /** Fetch the matching-relevant subset of a user's profile. */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
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

  /**
   * SQLite pre-filter + normalisation across the three opportunity tables.
   *
   * Uses TypeORM QueryBuilder (not raw SQL) so the parameter placeholder
   * syntax is handled per-driver. `LOWER(col) LIKE` works on both PostgreSQL
   * (local) and SQLite (HF Spaces), avoiding the Postgres-only `ILIKE` that
   * would throw on the bundled SQLite DB.
   */
  async preFilterOpportunities(options?: MatchOptions): Promise<NormalizedOpportunity[]> {
    const now = new Date();
    const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, 60);
    const field = options?.field?.trim();
    const typeFilter = options?.type?.trim();
    const hasField = !!field;
    const hasType = !!typeFilter;

    // --- opportunities: competitions / events / exchanges / volunteering ---
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
      oppQb.andWhere(
        '(LOWER(opp.title) LIKE LOWER(:f) OR LOWER(opp.description) LIKE LOWER(:f) '
        + 'OR LOWER(opp.requirements) LIKE LOWER(:f) OR LOWER(opp.organization) LIKE LOWER(:f) '
        + 'OR LOWER(opp.region) LIKE LOWER(:f))',
        { f },
      );
    }

    // --- scholarships: government / university / private funding ---
    const scholarQb = this.scholarRepo.createQueryBuilder('sch')
      .where('sch.deleted_at IS NULL')
      .andWhere('sch.status = :status', { status: 'active' })
      .andWhere('(sch.deadline IS NULL OR sch.deadline > :now)', { now })
      .orderBy('sch.created_at', 'DESC')
      .limit(limit);
    if (hasField) {
      const f = `%${field}%`;
      // eligibilty_criteria is a json array column; on SQLite it is stored as
      // JSON text so a direct LIKE works. On Postgres jsonb we cast to text.
      // Use a raw OR-clause that is valid on both drivers.
      scholarQb.andWhere(
        '(LOWER(sch.title) LIKE LOWER(:f) OR LOWER(sch.description) LIKE LOWER(:f) '
        + 'OR LOWER(sch.provider) LIKE LOWER(:f))',
        { f },
      );
    }

    // --- jobs: crawled internships / full-time roles ---
    const jobQb = this.jobRepo.createQueryBuilder('job')
      .where('job.status = :status', { status: 'active' })
      .andWhere('(job.application_deadline IS NULL OR job.application_deadline > :now)', { now })
      .orderBy('job.created_at', 'DESC')
      .limit(limit);
    if (hasField) {
      const f = `%${field}%`;
      jobQb.andWhere(
        '(LOWER(job.title) LIKE LOWER(:f) OR LOWER(job.description) LIKE LOWER(:f) '
        + 'OR LOWER(job.company_name) LIKE LOWER(:f))',
        { f },
      );
    }

    const [oppRows, scholarRows, jobRows] = await Promise.all([
      oppQb.getRawMany(),
      scholarQb.getRawMany(),
      jobQb.getRawMany(),
    ]);

    const candidates: NormalizedOpportunity[] = [];

    const parseJson = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String);
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch {
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

    // Narrow by type when requested (covers rows whose `type` was synthesised).
    const filtered = hasType
      ? candidates.filter((c) => c.type.toLowerCase() === typeFilter.toLowerCase() || c.source_table === typeFilter)
      : candidates;

    // Defence-in-depth: drop any row whose deadline already passed (the SQL
    // filter handles this, but raw-date parsing edge-cases happen on SQLite).
    return filtered.filter((c) => !c.deadline || new Date(c.deadline) > now);
  }

  /**
   * Orchestrator: pre-filter (T1) then ask the AI service to perform NLP
   * criteria extraction + semantic scoring (T2). Falls back to the keyword
   * pre-score when the AI service is unreachable so the radar always returns
   * something usable instead of an empty state.
   */
  async matchOpportunities(
    userId: string,
    options?: MatchOptions,
    profileOverrides?: Partial<UserProfile>,
  ): Promise<any> {
    const profile = { ...(await this.getUserProfile(userId)), ...(profileOverrides || {}) };
    const candidates = await this.preFilterOpportunities(options);

    this.logger.log(`[OpportunityRadar] pre-filtered ${candidates.length} candidates for user ${userId}`);

    try {
      const aiResult = await this.aiService.matchOpportunities({
        user_profile: profile,
        opportunities: candidates,
      });
      return aiResult;
    } catch (err: any) {
      // Graceful degradation: the AI service may be restarting after an HF Space
      // restart or all LLM providers may be down. Return the keyword-scored
      // candidates so the frontend radar still renders (with a degraded flag).
      this.logger.warn(`[OpportunityRadar] AI service unavailable, using keyword fallback: ${err.message}`);
      return this._keywordFallback(profile, candidates, String(err?.message || err));
    }
  }

  /** Keyword-only scoring fallback — mirrors the AI service's degraded path. */
  private _keywordFallback(profile: UserProfile, candidates: NormalizedOpportunity[], err: string) {
    const profileTerms = [profile.major, ...(profile.skills || []), ...(profile.interests || [])]
      .filter(Boolean)
      .map((t) => t.toLowerCase());
    const region = (profile.location || '').toLowerCase();

    const now = new Date();
    const matches = candidates
      .filter((c) => {
        if (c.deadline && new Date(c.deadline) <= now) return false;
        return true;
      })
      .map((c) => {
        const text = `${c.title} ${c.description} ${c.requirements} ${(c.field_tags || []).join(' ')} ${c.organization}`.toLowerCase();

        let score = 0;
        const reasons: string[] = [];
        for (const term of profileTerms) {
          if (term && text.includes(term)) {
            score += 12;
            if (reasons.length < 4) reasons.push(`Khớp: ${term}`);
          }
        }
        if (region && (c.region.toLowerCase().includes(region) || text.includes(region))) {
          score += 15;
          if (reasons.length < 4) reasons.push('Khu vực phù hợp');
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
    if (c.type === 'scholarship') list.push('Bản sao bằng cấp + Chứng nhận hành vi');
    return list;
  }
}
