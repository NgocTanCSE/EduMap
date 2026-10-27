"use client";
import React, { useState, useEffect } from 'react';
import { adminService, QuestionGapReport, QuestionGapCluster, QuestionGapItem } from '@/reporting/services/admin.service';
import { toast } from 'sonner';
import {
  BrainCircuit, RefreshCw, Search, BarChart3, AlertTriangle,
  FileText, Tag, TrendingUp, Database, Clock, CheckCircle,
  XCircle, HelpCircle, Info
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const QUALITY_COLORS: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  unknown: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const QUALITY_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  partial: <HelpCircle className="w-4 h-4 text-amber-400" />,
  failed: <XCircle className="w-4 h-4 text-red-400" />,
};

function QualityBadge({ status }: { status: string }) {
  const cls = QUALITY_COLORS[status] || QUALITY_COLORS.unknown;
  const Icon = QUALITY_ICONS[status] || QUALITY_ICONS.unknown;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${cls}`}>
      {Icon}
      {status}
    </span>
  );
}

function QualityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let color = 'bg-emerald-400';
  if (score < 0.3) color = 'bg-red-400';
  else if (score < 0.5) color = 'bg-amber-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground/40 w-10">{pct}%</span>
    </div>
  );
}

export default function AdminQuestionGapsPage() {
  const [report, setReport] = useState<QuestionGapReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data: QuestionGapReport = await adminService.getQuestionGaps(10000);
      setReport(data);
      if (data?.degraded) {
        toast.warning('Báo cáo đã ở chế độ giảm tốc — một số tính năng có thể không khả dụng.');
      }
    } catch (error) {
      console.error('Error fetching question gaps:', error);
      toast.error('Không thể tải báo cáo khoảng trống tri thức.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, []);

  if (loading) {
    return (
      <div className="p-20 text-center text-muted-foreground/40">
        Đang phân tích khoảng trống tri thức từ log truy vấn...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <BrainCircuit className="w-8 h-8" />
              Báo cáo Khoảng trống Tri thức AI
            </h1>
            <p className="text-muted-foreground/60 mt-2">
              Ý tưởng #17: Phân tích truy vấn ẩn danh, phân cụm chủ đề, đề xuất tài liệu bổ trợ.
            </p>
          </div>
          <button
            onClick={() => void fetchReport()}
            className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Làm mới
          </button>
        </div>

        {!report && (
          <div className="p-8 rounded-lg bg-card/40 border border-border text-center">
            <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground/60">Chưa có dữ liệu truy vấn nào trong hệ thống.</p>
          </div>
        )}

        {report && (
          <>
            {/* Privacy notice */}
            {report.privacy && (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/20 border border-slate-600/30 text-sm text-muted-foreground/70">
                <Info className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <span>
                  Toàn bộ truy vấn được ẩn danh bằng SHA-256 (user_id_hash). Dữ liệu tự động xóa sau{' '}
                  <strong>{report.privacy.ttl_days} ngày</strong> theo chính sách bảo mật.
                </span>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <SummaryCard
                title="Tổng truy vấn"
                value={report.total_queries.toLocaleString('vi-VN')}
                icon={Search}
                color="text-primary"
                bg="bg-primary/10"
              />
              <SummaryCard
                title="Câu hỏi có khoảng trống"
                value={report.top_gaps?.length?.toLocaleString('vi-VN') || '0'}
                icon={AlertTriangle}
                color="text-red-400"
                bg="bg-red-400/10"
              />
              <SummaryCard
                title="Chủ đề (cụm)"
                value={report.clusters?.length?.toLocaleString('vi-VN') || '0'}
                icon={Tag}
                color="text-blue-400"
                bg="bg-blue-400/10"
              />
              <SummaryCard
                title="Giới hạn phân tích"
                value={report.limit_applied?.toLocaleString('vi-VN') || '10,000'}
                icon={Database}
                color="text-amber-400"
                bg="bg-amber-400/10"
              />
            </div>

            {/* Summary text */}
            <div className="p-6 rounded-lg bg-card/30 border border-border">
              <p className="text-sm text-muted-foreground/70 leading-relaxed">{report.summary}</p>
              {report.date_range && (report.date_range.start || report.date_range.end) && (
                <p className="text-xs text-muted-foreground/50 mt-2">
                  Phạm vi thời gian: {report.date_range.start || 'N/A'} → {report.date_range.end || 'N/A'}
                  {report.cached && <span className="ml-2 italic">(dữ liệu cache)</span>}
                </p>
              )}
            </div>

            {/* Degraded warning */}
            {report.degraded && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-300">Chế độ giảm tốc đã bật</p>
                  <p className="text-sm text-red-300/80 mt-1">{report.reason}</p>
                </div>
              </div>
            )}

            {/* Clusters */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Cụm chủ đề & Khoảng trống
              </h2>
              {report.clusters && report.clusters.length > 0 ? (
                <div className="space-y-4">
                  {report.clusters.map((cluster: QuestionGapCluster) => (
                    <ClusterCard key={cluster.cluster_id} cluster={cluster} />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-lg bg-card/40 border border-border text-center">
                  <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground/60">
                    Chưa có cụm chủ đề nào — hãy chờ người dùng tạo truy vấn AI.
                  </p>
                </div>
              )}
            </div>

            {/* Top gap queries */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-red-400" />
                Truy vấn chưa trả lời tốt nhất
              </h2>
              {report.top_gaps && report.top_gaps.length > 0 ? (
                <div className="space-y-3">
                  {report.top_gaps.map((gap: QuestionGapItem, idx: number) => (
                    <GapRow key={idx} gap={gap} idx={idx} />
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-card/40 border border-border text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400/30 mx-auto mb-3" />
                  <p className="text-muted-foreground/60">Tất cả truy vấn đều đạt chất lượng tốt.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

function SummaryCard({ title, value, icon: Icon, color, bg }: SummaryCardProps) {
  return (
    <div className="p-6 rounded-xl bg-card/50 border border-border hover:border-primary/50 transition-all">
      <div className={`w-12 h-12 rounded-lg ${bg} ${color} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground/40 uppercase font-bold mt-1 tracking-widest">{title}</p>
    </div>
  );
}

interface ClusterCardProps {
  cluster: QuestionGapCluster;
}

function ClusterCard({ cluster }: ClusterCardProps) {
  const gapPct = Math.round(cluster.gap_rate * 100);
  return (
    <div className="p-6 rounded-xl bg-card/50 border border-border space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Chủ đề: "{cluster.topic}"
          </h3>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {cluster.total_queries} truy vấn · {cluster.gap_count} khoảng trống · Tỷ lệ gap: <strong>{gapPct}%</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground/40">cụm #{cluster.cluster_id}</span>
        </div>
      </div>

      {/* Top terms */}
      {cluster.top_terms && cluster.top_terms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cluster.top_terms.map((term, i) => (
            <span key={i} className="px-2 py-1 bg-slate-800/30 border border-slate-700 rounded text-xs text-slate-300">
              {term}
            </span>
          ))}
        </div>
      )}

      {/* Representative query */}
      {cluster.representative_query && (
        <div className="p-3 rounded-lg bg-slate-900/20 border border-slate-700/30">
          <span className="text-xs text-muted-foreground/50">Truy vấn đại diện:</span>
          <p className="text-sm mt-1">"{cluster.representative_query}"</p>
        </div>
      )}

      {/* Recommended docs */}
      {cluster.recommended_docs && cluster.recommended_docs.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground/50 uppercase font-bold">Đề xuất tài liệu:</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {cluster.recommended_docs.map((doc, i) => (
              <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2">
                <FileText className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">{doc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap queries preview */}
      {cluster.gap_queries && cluster.gap_queries.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground/50 uppercase font-bold">Câu hỏi chưa trả lời tốt:</span>
          <div className="space-y-1 mt-2">
            {cluster.gap_queries.slice(0, 5).map((q, i) => (
              <div key={i} className="text-xs text-muted-foreground/70 p-2 bg-slate-900/20 rounded border-l-2 border-red-500/30">
                {q}
              </div>
            ))}
            {cluster.gap_queries.length > 5 && (
              <p className="text-xs text-muted-foreground/40">
                +{cluster.gap_queries.length - 5} câu hỏi khác...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface GapRowProps {
  gap: QuestionGapItem;
  idx: number;
}

function GapRow({ gap, idx }: GapRowProps) {
  return (
    <div className="p-4 rounded-lg bg-card/50 border border-border flex items-start gap-4">
      <span className="text-xs text-muted-foreground/40 font-mono flex-shrink-0 mt-0.5">#{idx + 1}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <QualityBadge status={gap.retrieval_status || 'unknown'} />
          <QualityBar score={gap.response_quality || 0} />
          <span className="text-xs text-muted-foreground/50 flex items-center gap-1">
            <Database className="w-3 h-3" />
            {gap.retrieved_doc_count} tài liệu
          </span>
        </div>
        <p className="text-sm text-muted-foreground/80 line-clamp-2">{gap.query_text}</p>
        {gap.created_at && (
          <p className="text-xs text-muted-foreground/40 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(gap.created_at).toLocaleString('vi-VN')}
          </p>
        )}
      </div>
    </div>
  );
}
