"use client";

import React, { useEffect, useState } from 'react';
import {
  Target, Search, Filter, BrainCircuit, Sparkles, DollarSign,
  MapPin, Clock, Tag, ExternalLink, TrendingUp, CheckCircle,
  AlertCircle, Loader2, Plus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { impactMatchService, SponsorNeed, SponsorProfile, MatchResult, RankMatchesResponse } from '@/src/services/impact-match.service';
import { authService } from '@/src/services/auth.service';

const NEED_CATEGORIES = ['Tất cả', 'education_equipment', 'scholarship', 'infrastructure', 'environment', 'social_welfare'];
const URGENCY_LABELS: Record<string, string> = {
  critical: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};
const URGENCY_COLORS: Record<string, string> = {
  critical: 'bg-destructive/20 text-destructive border-destructive/30',
  high: 'bg-primary/20 text-primary border-primary/30',
  medium: 'bg-primary/10 text-primary/80 border-primary/20',
  low: 'bg-muted/40 text-foreground/60 border-border',
};

export default function ImpactMatchPage() {
  // Data
  const [needs, setNeeds] = useState<SponsorNeed[]>([]);
  const [sponsors, setSponsors] = useState<SponsorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);

  // Filters
  const [regionFilter, setRegionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả');
  const [maxCostFilter, setMaxCostFilter] = useState('');

  // Results
  const [rankedMatches, setRankedMatches] = useState<MatchResult[]>([]);
  const [rankResponse, setRankResponse] = useState<RankMatchesResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Modals
  const [showNeedModal, setShowNeedModal] = useState(false);
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [needForm, setNeedForm] = useState({ title: '', description: '', category: 'education_equipment', urgency: 'medium', cost_estimate: '', location: '', tags: '', apply_url: '' });
  const [sponsorForm, setSponsorForm] = useState({ name: '', description: '', focus_areas: '', budget_amount: '', location: '', website_url: '', contact_email: '' });

  // ── Fetch data on mount ──────────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [needsRes, sponsorsRes] = await Promise.all([
        impactMatchService.getNeeds({ status: 'open', limit: 50 }),
        impactMatchService.getSponsors({ limit: 50 }),
      ]);
      setNeeds(needsRes.items || []);
      setSponsors(sponsorsRes.items || []);
    } catch (error) {
      console.error('Error fetching ImpactMatch data:', error);
      toast.error('Không thể tải dữ liệu ImpactMatch');
    } finally {
      setLoading(false);
    }
  };

  // ── Rank with AI ─────────────────────────────────────────────────
  const handleRank = async () => {
    if (needs.length === 0 || sponsors.length === 0) {
      toast.warning('Cần có đủ dữ liệu nhu cầu và nhà tài trợ để ghẹp nối');
      return;
    }
    try {
      setLoadingRanking(true);
      setShowResults(true);
      setRankResponse(null);
      setRankedMatches([]);
      toast.info('AI đang phân tích và xếp hạng...');

      const response = await impactMatchService.rankMatches({
        region: regionFilter || undefined,
        category: categoryFilter !== 'Tất cả' ? categoryFilter : undefined,
        max_results: 15,
        max_cost: maxCostFilter ? Number(maxCostFilter) : undefined,
      });

      setRankResponse(response);
      setRankedMatches(response.ranked_matches || []);

      if (response.degraded) {
        toast.warning('AI đang ngoại tuyến — hiển thị kết quả dự phòng');
      } else if (response.ranked_matches?.length > 0) {
        toast.success(`Tìm thấy ${response.ranked_matches.length} cặp ghép phù hợp!`);
      } else {
        toast.info('Chưa tìm thấy cặp ghép phù hợp');
      }
    } catch (error) {
      console.error('Error ranking matches:', error);
      toast.error('Lỗi khi xếp hạng ghép nối');
    } finally {
      setLoadingRanking(false);
    }
  };

  // ── Create ───────────────────────────────────────────────────────
  const handleCreateNeed = async () => {
    if (!needForm.title || !needForm.description || !needForm.category) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    try {
      const tagsArr = needForm.tags ? needForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      await impactMatchService.createNeed({
        title: needForm.title,
        description: needForm.description,
        category: needForm.category,
        urgency: needForm.urgency as any,
        cost_estimate: Number(needForm.cost_estimate) || 0,
        location: needForm.location,
        tags: tagsArr,
        apply_url: needForm.apply_url,
      });
      toast.success('Đã tạo nhu cầu mới');
      setShowNeedModal(false);
      setNeedForm({ title: '', description: '', category: 'education_equipment', urgency: 'medium', cost_estimate: '', location: '', tags: '', apply_url: '' });
      fetchData();
    } catch (error) {
      toast.error('Không thể tạo nhu cầu');
    }
  };

  const handleCreateSponsor = async () => {
    if (!sponsorForm.name || !sponsorForm.focus_areas || !sponsorForm.budget_amount) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    try {
      const focusAreasArr = sponsorForm.focus_areas.split(',').map(t => t.trim()).filter(Boolean);
      await impactMatchService.createSponsor({
        name: sponsorForm.name,
        description: sponsorForm.description,
        focus_areas: focusAreasArr,
        budget_amount: Number(sponsorForm.budget_amount) || 0,
        location: sponsorForm.location,
        website_url: sponsorForm.website_url,
        contact_email: sponsorForm.contact_email,
      });
      toast.success('Đã tạo hồ sơ nhà tài trợ mới');
      setShowSponsorModal(false);
      setSponsorForm({ name: '', description: '', focus_areas: '', budget_amount: '', location: '', website_url: '', contact_email: '' });
      fetchData();
    } catch (error) {
      toast.error('Không thể tạo nhà tài trợ');
    }
  };

  // ── Render helpers ───────────────────────────────────────────────
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const UrgencyBadge = ({ urgency }: { urgency: string }) => (
    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${URGENCY_COLORS[urgency] || URGENCY_COLORS.medium}`}>
      {URGENCY_LABELS[urgency] || urgency}
    </span>
  );

  const NeedCard = ({ need }: { need: SponsorNeed }) => (
    <Card className="border-border hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-1">{need.title}</CardTitle>
          <UrgencyBadge urgency={need.urgency} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {need.description && (
          <p className="text-sm text-foreground/60 line-clamp-3 mb-3">{need.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="px-2 py-1 bg-card/40 border border-border rounded text-xs font-semibold">
            {need.category}
          </span>
          {need.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-1 bg-card/30 border border-border rounded text-xs">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-foreground/60">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span>{formatCurrency(Number(need.cost_estimate))}</span>
          </div>
          {need.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{need.location}</span>
            </div>
          )}
        </div>
        {need.provenance && (
          <p className="text-[10px] text-foreground/40 mt-2 line-clamp-1">
            {need.provenance}
          </p>
        )}
      </CardContent>
    </Card>
  );

  const SponsorCard = ({ sponsor }: { sponsor: SponsorProfile }) => (
    <Card className="border-border hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-1">{sponsor.name}</CardTitle>
          {sponsor.is_verified && (
            <CheckCircle className="w-5 h-5 text-accent shrink-0" />
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {sponsor.description && (
          <p className="text-sm text-foreground/60 line-clamp-3 mb-3">{sponsor.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {sponsor.focus_areas?.slice(0, 4).map(fa => (
            <span key={fa} className="px-2 py-1 bg-card/40 border border-border rounded text-xs font-semibold">
              {fa}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-foreground/60">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span>{formatCurrency(Number(sponsor.budget_amount))} ({sponsor.budget_currency})</span>
          </div>
          {sponsor.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{sponsor.location}</span>
            </div>
          )}
        </div>
        {sponsor.website_url && (
          <a
            href={sponsor.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary mt-2"
          >
            <ExternalLink className="w-3 h-3" />
            Trang chính thức
          </a>
        )}
      </CardContent>
    </Card>
  );

  const MatchResultCard = ({ match, idx }: { match: MatchResult; idx: number }) => {
    const need = match.need;
    const sponsor = match.sponsor;
    return (
      <Card className="border-primary/30 bg-gradient-to-b from-primary/5 to-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">#{idx + 1} — {need?.title || match.need_id}</CardTitle>
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 px-3 py-1 rounded-full">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-bold text-primary">{Math.round(match.match_score)}%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {/* Need */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Nhu cầu</h4>
              <p className="font-semibold">{need?.title || match.need_id}</p>
              <p className="text-sm text-foreground/60 line-clamp-2">{need?.description || ''}</p>
              <div className="flex items-center gap-4 text-xs text-foreground/50">
                <span>Chi phí: {formatCurrency(need?.cost_estimate || 0)}</span>
                <span>Danh mục: {need?.category}</span>
              </div>
            </div>
            {/* Sponsor */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Nhà tài trợ</h4>
              <p className="font-semibold">{sponsor?.name || match.sponsor_id}</p>
              <p className="text-sm text-foreground/60 line-clamp-2">{sponsor?.description || ''}</p>
              <div className="flex items-center gap-4 text-xs text-foreground/50">
                <span>Ngân sách: {formatCurrency(sponsor?.budget_amount || 0)}</span>
                {sponsor?.location && <span>Khu vực: {sponsor.location}</span>}
              </div>
            </div>
          </div>

          {/* Match reasons */}
          {match.match_reasons && match.match_reasons.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Lý do phù hợp</h5>
              <ul className="space-y-1">
                {match.match_reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          {match.next_steps && match.next_steps.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Bước tiếp theo</h5>
              <ul className="space-y-1">
                {match.next_steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                    <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <ContentShell>
      {/* Header */}
      <SectionHeader
        title="ImpactMatch — Ghép nhu cầu ↔ Nhà tài trợ"
        subtitle="Hệ thống AI giúp nguồn lực đến đúng nơi cần: kết nối nhu cầu giáo dục với nhà tài trợ phù hợp dựa trên chi phí, khu vực và lĩnh vực."
        icon={Target}
        right={
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowNeedModal(true)} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Thêm nhu cầu
            </Button>
            <Button onClick={() => setShowSponsorModal(true)} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Thêm nhà tài trợ
            </Button>
          </div>
        }
      />

      {/* Filters + Rank button */}
      <div className="flex flex-col sm:flex-row gap-4 items-end justify-between p-4 bg-card/50 border border-border rounded-xl">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch flex-1">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase">Khu vực</label>
            <input
              type="text"
              placeholder="Ví dụ: Đồng Nai"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase">Danh mục</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:border-primary"
            >
              {NEED_CATEGORIES.map(c => (
                <option key={c} value={c}>{c === 'Tất cả' ? c : c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase">Chi phí tối đa (VND)</label>
            <input
              type="number"
              placeholder="500000000"
              value={maxCostFilter}
              onChange={(e) => setMaxCostFilter(e.target.value)}
              className="w-full sm:w-40 px-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        <Button
          onClick={handleRank}
          disabled={loadingRanking}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 gap-2"
        >
          {loadingRanking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang xếp hạng...
            </>
          ) : (
            <>
              <BrainCircuit className="w-4 h-4" />
              Xếp hạng bằng AI
            </>
          )}
        </Button>
      </div>

      {/* Degraded banner */}
      {rankResponse?.degraded && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-primary" />
          <span className="text-sm text-primary">
            {rankResponse.reason || 'AI đang ngoại tuyến — đang sử dụng kết quả dự phòng dựa trên tiêu chí chi phí.'}
          </span>
        </div>
      )}

      {/* Ranked Results */}
      {showResults && rankedMatches.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="text-primary/70" />
            <h2>Kết quả ghẹp nối ({rankedMatches.length} cặp)</h2>
        </div>
          <div className="space-y-4">
            {rankedMatches.map((match, idx) => (
              <MatchResultCard key={`${match.need_id}-${match.sponsor_id}`} match={match} idx={idx} />
            ))}
          </div>
        </div>
      )}

      {/* No results after rank */}
      {showResults && !loadingRanking && rankedMatches.length === 0 && !rankResponse?.degraded && (
        <EmptyState
          title="Chưa tìm thấy cặp ghép"
          description="Cặp nhu cầu ↔ nhà tài trợ phù hợp chưa được tìm thấy. Hãy thử điều chỉnh bộ lọc hoặc thêm nhu cầu/nhà tài trợ mới."
          icon={<Target className="w-8 h-8 text-foreground/30" />}
        />
      )}

      {/* Dual panels: needs + sponsors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Needs */}
        <div>
          <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-border flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Nhu cầu ({needs.length})
          </h3>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Card key={i} className="border-border h-40 animate-pulse" />)}
            </div>
          ) : needs.length > 0 ? (
            <div className="space-y-4">
              {needs.map(need => <NeedCard key={need.id} need={need} />)}
          </div>
          ) : (
            <EmptyState
              title="Chưa có nhu cầu nào"
              description="Hãy thêm nhu cầu đầu tiên để bắt đầu ghẹp nối."
              icon={<Target className="w-8 h-8 text-foreground/30" />}
            />
          )}
        </div>

        {/* Right: Sponsors */}
        <div>
          <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-border flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Nhà tài trợ ({sponsors.length})
          </h3>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Card key={i} className="border-border h-40 animate-pulse" />)}
            </div>
          ) : sponsors.length > 0 ? (
            <div className="space-y-4">
              {sponsors.map(sponsor => <SponsorCard key={sponsor.id} sponsor={sponsor} />)}
            </div>
          ) : (
            <EmptyState
              title="Chưa có nhà tài trợ nào"
              description="Hãy thêm hồ sơ nhà tài trợ đầu tiên để bắt đầu."
              icon={<TrendingUp className="w-8 h-8 text-foreground/30" />}
            />
          )}
        </div>
      </div>

      {/* ── Create Need Modal ──────────────────────────────────────── */}
      {showNeedModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Thêm nhu cầu cần tài trợ</h3>
              <button onClick={() => setShowNeedModal(false)} className="p-1 rounded-lg hover:bg-card/50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Tiêu đề *</label>
                <input type="text" placeholder="Ví dụ: Xây thư viện STEM cho THPT Trấn Biên" value={needForm.title} onChange={e => setNeedForm({...needForm, title: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Mô tả chi tiết *</label>
                <textarea placeholder="Mô tả mục tiêu, lợi ích..." value={needForm.description} onChange={e => setNeedForm({...needForm, description: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary h-24 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Danh mục *</label>
                  <select value={needForm.category} onChange={e => setNeedForm({...needForm, category: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary">
                    <option value="education_equipment">Thiết bị giáo dục</option>
                    <option value="scholarship">Học bổng</option>
                    <option value="infrastructure">Cơ sở hạ tầng</option>
                    <option value="environment">Môi trường</option>
                    <option value="social_welfare">Xã hội</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Độ khẩn cấp *</label>
                  <select value={needForm.urgency} onChange={e => setNeedForm({...needForm, urgency: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary">
                    <option value="critical">Khẩn cấp</option>
                    <option value="high">Cao</option>
                    <option value="medium">Trung bình</option>
                    <option value="low">Thấp</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Chi phí dự kiến (VND) *</label>
                <input type="number" placeholder="200000000" value={needForm.cost_estimate} onChange={e => setNeedForm({...needForm, cost_estimate: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Khu vực</label>
                <input type="text" placeholder="Biên Hòa, Đồng Nai" value={needForm.location} onChange={e => setNeedForm({...needForm, location: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Thẻ (tags) — cách nhau bằng dấu phẩy</label>
                <input type="text" placeholder="stem, education, library" value={needForm.tags} onChange={e => setNeedForm({...needForm, tags: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL nguồn chính thức (provenance)</label>
                <input type="url" placeholder="https://..." value={needForm.apply_url} onChange={e => setNeedForm({...needForm, apply_url: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNeedModal(false)} className="flex-1 px-4 py-2 bg-card/50 border border-border rounded-lg text-sm font-medium hover:bg-card transition-colors">
                Hủy
              </button>
              <button onClick={handleCreateNeed} className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors">
                Tạo nhu cầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Sponsor Modal ──────────────────────────────────────── */}
      {showSponsorModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Thêm hồ sơ nhà tài trợ</h3>
              <button onClick={() => setShowSponsorModal(false)} className="p-1 rounded-lg hover:bg-card/50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Tên tổ chức *</label>
                <input type="text" placeholder="Ví dụ: Bộ Giáo dục và Đào tạo" value={sponsorForm.name} onChange={e => setSponsorForm({...sponsorForm, name: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Mô tả</label>
                <textarea placeholder="Giới thiệu ngắn về tổ chức..." value={sponsorForm.description} onChange={e => setSponsorForm({...sponsorForm, description: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary h-20 resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Lĩnh vực tài trợ (cách nhau bằng dấu phẩy) *</label>
                <input type="text" placeholder="education, scholarship, stem" value={sponsorForm.focus_areas} onChange={e => setSponsorForm({...sponsorForm, focus_areas: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Ngân sách tối đa (VND) *</label>
                <input type="number" placeholder="1000000000" value={sponsorForm.budget_amount} onChange={e => setSponsorForm({...sponsorForm, budget_amount: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Khu vực</label>
                <input type="text" placeholder="Hà Nội" value={sponsorForm.location} onChange={e => setSponsorForm({...sponsorForm, location: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Website</label>
                <input type="url" placeholder="https://..." value={sponsorForm.website_url} onChange={e => setSponsorForm({...sponsorForm, website_url: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email liên hệ</label>
                <input type="email" placeholder="contact@org.vn" value={sponsorForm.contact_email} onChange={e => setSponsorForm({...sponsorForm, contact_email: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSponsorModal(false)} className="flex-1 px-4 py-2 bg-card/50 border border-border rounded-lg text-sm font-medium hover:bg-card transition-colors">
                Hủy
              </button>
              <button onClick={handleCreateSponsor} className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors">
                Tạo hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}
    </ContentShell>
  );
}
