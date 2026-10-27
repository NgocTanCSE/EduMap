"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Target, RefreshCw, CheckCircle2, ExternalLink, Clock, MapPin, GraduationCap, Briefcase, Trophy, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authService } from '@/src/services/auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

/* ── Types ────────────────────────────────────────────────────────── */

interface UserProfileLite {
  id: string;
  full_name: string;
  major: string;
  skills: string[];
  interests: string[];
  location: string;
  role: string;
  gpa?: number | null;
}

interface MatchItem {
  id: string;
  title: string;
  organization: string;
  type: string;
  url: string | null;
  deadline: string | null;
  region: string;
  match_score: number;
  confidence: number;
  confidence_level: 'high' | 'medium' | 'low';
  is_eligible: boolean;
  extracted_criteria: Record<string, any>;
  match_reasons: string[];
  checklist: string[];
}

interface MatchResponse {
  user_id: string;
  matches: MatchItem[];
  total: number;
  filtered_count: number;
  degraded: boolean;
  reason?: string | null;
}

/* ── Constants ───────────────────────────────────────────────────── */

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  scholarship: GraduationCap,
  internship: Briefcase,
  job: Briefcase,
  competition: Trophy,
  hackathon: Trophy,
  event: Calendar,
  volunteer: Target,
};

function getTypeIcon(type: string) {
  const key = type.toLowerCase();
  const Icon = TYPE_ICON[key] || Target;
  return <Icon className="w-4 h-4" />;
}

/* ── Confidence badge ────────────────────────────────────────────── */

function ConfidenceBadge({ confidence, level }: { confidence: number; level: string }) {
  const pct = Math.round(confidence * 100);
  if (level === 'high') {
    return <Badge className="bg-green-100 text-green-800 border-green-200">Cao ({pct}%)</Badge>;
  }
  if (level === 'medium') {
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Trung bình ({pct}%)</Badge>;
  }
  return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Thấp ({pct}%)</Badge>;
}

/* ── Deadline pill ───────────────────────────────────────────────── */

function DeadlinePill({ deadline }: { deadline: string | null }) {
  if (!deadline) return <Badge variant="outline" className="text-xs">Không rõ hạn</Badge>;
  const d = new Date(deadline);
  const isPast = d < new Date();
  const formatted = d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Badge variant={isPast ? 'destructive' : 'outline'} className="text-xs">
      <Clock className="w-3 h-3 mr-1" />{formatted}
    </Badge>
  );
}

/* ── Score bar ──────────────────────────────────────────────────── */

function ScoreBar({ score }: { score: number }) {
  let color = 'bg-red-500';
  if (score >= 75) color = 'bg-green-500';
  else if (score >= 50) color = 'bg-amber-500';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span>Điểm phù hợp</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}

/* ── Opportunity Card ────────────────────────────────────────────── */

function OpportunityCard({ item }: { item: MatchItem }) {
  const eligible = item.is_eligible;

  return (
    <Card className="mb-4 transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {getTypeIcon(item.type)}
            <CardTitle className="text-lg">{item.title}</CardTitle>
          </div>
          <ScoreBar score={item.match_score} />
        </div>
        <div className="flex flex-wrap gap-2 text-xs mt-1">
          <Badge variant="secondary">{item.type}</Badge>
          <ConfidenceBadge confidence={item.confidence} level={item.confidence_level} />
          <DeadlinePill deadline={item.deadline} />
          {eligible ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Đạt điều kiện
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-orange-700">
              <AlertCircle className="w-3 h-3 mr-1" /> Cần xem xét
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {item.organization && (
          <p className="text-sm text-muted-foreground mb-2">{item.organization}</p>
        )}
        {item.region && (
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {item.region}
          </p>
        )}

        {/* Lý do khớp */}
        {item.match_reasons.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Lý do phù hợp:</p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              {item.match_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {/* Checklist hồ sơ */}
        {item.checklist.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Hồ sơ cần chuẩn bị:</p>
            <ul className="flex flex-wrap gap-1.5">
              {item.checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-1 text-xs bg-muted/40 px-2 py-1 rounded">
                  <CheckCircle2 className="w-3 h-3 text-green-600" /> {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nguồn chính thức */}
        {item.url && (
          <div className="mt-3 pt-3 border-t border-border">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              Nguồn chính thức ↗
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */

export default function OpportunityRadarPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileLite | null>(null);

  // Filters / options
  const [gpa, setGpa] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterField, setFilterField] = useState<string>('');

  // Check auth on mount
  useEffect(() => {
    if (!authService.isLoggedIn()) {
      // Not logged in → redirect to login, then back here
      const redirect = encodeURIComponent(window.location.pathname);
      window.location.href = `/auth/login?redirect=${redirect}`;
      return;
    }
    // Load cached profile + trigger first match
    const loadProfile = async () => {
      try {
        await authService.fetchUserProfile();
      } catch (e) {
        // non-fatal — profile is re-fetched by the backend from the DB
      }
    };
    loadProfile();
  }, []);

  // Auto-run on mount for logged-in users
  useEffect(() => {
    if (authService.isLoggedIn()) {
      void runMatch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, []);

  const runMatch = useCallback(async () => {
    const token = authService.getAccessToken();
    if (!token) {
      toast.error('Vui lòng đăng nhập để sử dụng Opportunity Radar');
      window.location.href = '/auth/login?redirect=/opportunities/radar';
      return;
    }

    setLoading(true);
    const body: Record<string, any> = {};
    if (filterType) body.type = filterType;
    if (filterField) body.field = filterField;
    if (gpa) body.gpa = parseFloat(gpa);

    try {
      const response = await fetchWithRetry('/api/opportunities/match', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        // Token invalid — redirect to login
        window.location.href = '/auth/login?redirect=/opportunities/radar';
        return;
      }

      const data = await response.json();
      const result: MatchResponse = unwrapApiResponse(data);

      setMatches(result.matches || []);
      setTotal(result.total || 0);
      setFilteredCount(result.filtered_count || 0);
      setDegraded(result.degraded || false);
      setDegradedReason(result.reason || null);
    } catch (error: any) {
      toast.error(error?.message || 'Lỗi kết nối tới Opportunity Radar');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterField, gpa]);

  const handleApplyFilters = () => {
    void runMatch();
  };

  const handleReset = () => {
    setFilterType('');
    setFilterField('');
    setGpa('');
    void runMatch();
  };

  return (
    <ContentShell>
      <SectionHeader
        title="Opportunity Radar"
        subtitle="Tìm học bổng, khóa học miễn phí, cuộc thi phù hợp với hồ sơ của bạn. AI phân tích điều kiện và đưa ra lý do + checklist hồ sơ."
      />

      {/* Degraded banner */}
      {degraded && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Chế độ ngoại tuyến:</strong>
            {degradedReason ? ` ${degradedReason}` : ''}
            <span className="block mt-1">
              Kết quả dựa trên điểm số từ khóa. Đăng nhập với API key đầy đủ để nhận điểm số AI chính xác hơn.
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Loại cơ hộp</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1.5 bg-background"
              >
                <option value="">Tất cả</option>
                <option value="scholarship">Học bổng</option>
                <option value="internship">Thực tập</option>
                <option value="job">Công việc</option>
                <option value="competition">Cuộc thi</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Từ khóa (ngành/kỹ năng)</label>
              <input
                type="text"
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                placeholder="ví dụ: CNTT, AI, thiết kế..."
                className="w-full text-sm border rounded px-2 py-1.5 bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">GPA (tùy chọn)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="4"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="ví dụ: 3.5"
                className="w-full text-sm border rounded px-2 py-1.5 bg-background"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilters} disabled={loading} className="flex-1">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Áp dụng'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={loading}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
          ))}
        </div>
      ) : matches.length > 0 ? (
        <>
          <div className="mb-3 text-sm text-muted-foreground">
            {total} cơ hộp phù hợp · {filteredCount} đã lọc (hết hạn)
          </div>
          <div className="space-y-0">
            {matches.map((item) => <OpportunityCard key={item.id} item={item} />)}
          </div>
        </>
      ) : (
        <EmptyState
          title="Chưa có cơ hộp phù hợp"
          description={degraded
            ? "AI đang ở chế độ ngoại tuyến. Điều chỉnh từ khóa hoặc GPA và thử lại."
            : "Không tìm thấy cơ hộp nào phù hợp với hồ sơ hiện tại. Hãy thử mở rộng từ khóa tìm kiếm."}
          icon={<Target className="w-8 h-8" />}
        />
      )}
    </ContentShell>
  );
}
