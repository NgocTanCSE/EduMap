"use client";
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle,
  Clock,
  Info,
  Leaf,
  Loader2,
  MapPin,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { greenService, GreenChallenge } from '@/src/services/green.service';
import { gamificationService, UserProgress } from '@/reporting/services/gamification.service';
import { authService } from '@/src/services/auth.service';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';

/**
 * Green challenges + proof submission.
 *
 * UI sync notes (design-system pass):
 *  - Emoji were used as icons (in <option> labels and empty states). The
 *    select is now plain Vietnamese text and every visual marker is a lucide
 *    vector icon.
 *  - Challenge covers fall back to a vector `Leaf` tile instead of an
 *    `ILLUSTRATIONS.community` raster file.
 *  - Cards are `card-equal` with the CTA pinned via `card-footer`, so the
 *    buttons line up across a row; stat tiles share one surface + icon tile.
 */

const ACTIVITY_OPTIONS = [
  { value: 'RECYCLE', label: 'Phân loại & tái chế rác' },
  { value: 'TREE_PLANTING', label: 'Trồng cây xanh' },
  { value: 'PUBLIC_TRANSPORT', label: 'Sử dụng phương tiện công cộng' },
  { value: 'ENERGY_SAVING', label: 'Tiết kiệm năng lượng' },
];

export default function GreenPage() {
  const [challenges, setChallenges] = useState<GreenChallenge[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [activityType, setActivityType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mockProofUrl, setMockProofUrl] = useState(''); // demo proof image

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [challengesData, progressData] = await Promise.all([
        greenService.getChallenges(),
        authService.isLoggedIn() ? gamificationService.getMyProgress() : Promise.resolve(null),
      ]);
      setChallenges(challengesData);
      setProgress(progressData);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleMockUpload = () => {
    setMockProofUrl('/images/default-content.svg'); // placeholder asset served by HF /public
    toast.success('Đã đính kèm ảnh minh chứng mẫu (bản demo)');
  };

  const handleSubmitProof = async () => {
    if (!authService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập để nộp minh chứng');
      return;
    }
    if (!activityType || !mockProofUrl) {
      toast.error('Vui lòng chọn loại hoạt động và tải ảnh minh chứng');
      return;
    }

    try {
      setSubmitting(true);
      await greenService.submitProof(activityType, description, mockProofUrl);
      toast.success('Đã gửi báo cáo cho AI kiểm duyệt!');
      setActivityType('');
      setDescription('');
      setMockProofUrl('');
    } catch (error: any) {
      toast.error(error.message || 'Nộp báo cáo thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = [
    {
      icon: Leaf,
      value: `${((progress as any)?.carbon_saved || 0).toFixed(1)}kg`,
      label: 'CO₂ đã tiết kiệm',
    },
    {
      icon: Clock,
      value: `${((progress as any)?.volunteer_hours || 0).toFixed(1)}h`,
      label: 'Tình nguyện cộng đồng',
    },
    {
      icon: ShieldCheck,
      value: String(progress?.points || 0),
      label: 'Điểm tích luỹ xanh',
    },
  ];

  return (
    <main className="page-shell">
      <SectionHeader
        icon={Leaf}
        title="Thử thách xanh"
        subtitle="Tham gia hoạt động bảo vệ môi trường, nộp minh chứng và nhận điểm thưởng."
      />

      {/* Stats — same surface, same icon tile, same text alignment */}
      <div className="card-grid">
        {stats.map(({ icon: Icon, value, label }) => (
          <div key={label} className="card-surface flex items-start gap-3 p-5">
            <span className="icon-tile h-10 w-10">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-tight text-foreground">{value}</p>
              <p className="mt-0.5 text-xs font-medium text-foreground/60">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Green challenges */}
      <section aria-labelledby="green-challenges" className="space-y-3">
        <div className="border-b border-border pb-2.5">
          <h2 id="green-challenges" className="text-sm font-semibold text-foreground">
            Thử thách đang mở
          </h2>
          <p className="mt-0.5 text-xs text-foreground/55">
            Hoàn thành thử thách để nhận điểm XP và đóng góp vào bảng xếp hạng.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : challenges.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {challenges.map(item => (
              <article
                key={item.id}
                className="card-surface card-equal group overflow-hidden transition-colors hover:border-primary/40"
              >
                <div className="relative aspect-[21/9] shrink-0 overflow-hidden bg-primary/10">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // Vector placeholder — no raster illustration, no emoji
                    <div className="flex h-full w-full items-center justify-center">
                      <Leaf aria-hidden="true" className="h-10 w-10 text-primary/25" />
                    </div>
                  )}
                  <BookmarkButton targetType="green" targetId={item.id} size="sm" className="absolute right-3 top-3 z-10" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                      {item.title}
                    </h3>
                    <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      +{item.points} XP
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/55">
                    <span className="inline-flex items-center gap-1.5">
                      <Leaf className="h-3.5 w-3.5 text-primary" />
                      {(item.carbon_saved_kg || 0).toFixed(1)}kg CO₂
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-accent" />
                      {item.participants_count || 0} người tham gia
                    </span>
                  </div>

                  <div className="card-footer">
                    <span className="text-xs text-foreground/45">Thử thách xanh</span>
                    <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                      Tham gia ngay
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card-surface border-dashed">
            <EmptyState
              icon={<Leaf className="h-7 w-7 text-foreground/30" />}
              title="Chưa có thử thách nào đang diễn ra"
              description="Các chiến dịch mới sẽ xuất hiện tại đây khi được ban tổ chức công bố."
            />
          </div>
        )}
      </section>

      {/* Proof submission + guidance */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <Camera className="h-4 w-4 text-primary" />
            Nộp minh chứng sống xanh
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="activity-type" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/55">
                Loại hoạt động
              </label>
              <select
                id="activity-type"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
              >
                <option value="">Chọn loại hoạt động…</option>
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="activity-note" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/55">
                Mô tả thêm (tuỳ chọn)
              </label>
              <textarea
                id="activity-note"
                rows={2}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="VD: Tôi đã phân loại 2kg rác nhựa hôm nay…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/55">
                Minh chứng (hình ảnh)
              </span>
              {!mockProofUrl ? (
                <button
                  type="button"
                  onClick={handleMockUpload}
                  className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <UploadCloud className="mb-2 h-7 w-7 text-foreground/30" />
                  <span className="text-xs text-foreground/55">Nhấn để tải ảnh minh chứng lên</span>
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mockProofUrl} alt="Ảnh minh chứng" className="aspect-video w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setMockProofUrl('')}
                    aria-label="Xoá ảnh minh chứng"
                    className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/80 text-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmitProof}
              disabled={submitting || !activityType || !mockProofUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {submitting ? 'Đang xử lý…' : 'Gửi cho AI kiểm duyệt'}
            </button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="card-surface p-5">
            <div className="flex items-start gap-3">
              <span className="icon-tile h-10 w-10">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Quy trình duyệt tự động</h3>
                <p className="mt-1 text-xs leading-relaxed text-foreground/60">
                  Ảnh minh chứng được AI kiểm duyệt trước. Trường hợp chưa rõ sẽ chuyển
                  cho moderator xem xét thủ công.
                </p>
              </div>
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-start gap-3">
              <span className="icon-tile h-10 w-10">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Điểm thu gom gần bạn</h3>
                <p className="mt-1 text-xs leading-relaxed text-foreground/60">
                  Mở <span className="font-medium text-foreground/80">Bản đồ</span> và lọc theo
                  nhóm “Môi trường” để xem các điểm thu gom đã được kiểm chứng.
                </p>
              </div>
            </div>
          </section>

          <section className="card-surface flex items-start gap-3 border-dashed p-5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
            <p className="text-xs leading-relaxed text-foreground/55">
              Ảnh minh chứng chỉ dùng để xét duyệt và lưu tạm trên máy chủ HF Spaces;
              nội dung sẽ bị xoá khi Space khởi động lại.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
