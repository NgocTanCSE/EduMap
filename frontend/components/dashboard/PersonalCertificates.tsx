'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, Download, Hash, ShieldCheck, RefreshCw } from 'lucide-react';
import { certificateService } from '@/src/services/certificate.service';
import { CardSkeleton } from '@/src/components/ui/Skeleton';
import { toast } from 'sonner';

type Certificate = {
  id: string;
  verify_code: string;
  issued_at: string;
  template?: {
    name?: string;
    type?: string;
    organization?: { name?: string };
  };
};

type Portfolio = {
  total?: number;
  certificates?: Certificate[];
};

export function PersonalCertificates() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await certificateService.getPortfolio();
      setPortfolio((data as Portfolio) ?? null);
    } catch (error: any) {
      const message = error?.message || 'Không thể tải chứng chỉ';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const certificates: Certificate[] = Array.isArray(portfolio?.certificates)
    ? (portfolio?.certificates as Certificate[])
    : [];
  const total = portfolio?.total ?? certificates.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Chứng chỉ của tôi</h3>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Xem, xác minh và tải các chứng chỉ số đã nhận.
          </p>
        </div>
        {!loading && !loadError && (
          <span className="inline-flex items-center gap-2 self-start rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            <Award className="h-4 w-4" /> {total} chứng chỉ
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={loadPortfolio}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" /> Thử lại
          </button>
        </div>
      ) : certificates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="flex h-full flex-col rounded-lg border border-border bg-background/40 p-5 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Award className="h-5 w-5" />
                </div>
                <span className="rounded border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {cert.template?.type || 'Chứng chỉ'}
                </span>
              </div>

              <div className="mt-4 flex-1">
                <h4 className="text-base font-semibold leading-tight">
                  {cert.template?.name || 'Chứng chỉ'}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {cert.template?.organization?.name || 'EduMap'}
                </p>

                <div className="mt-4 space-y-1.5 border-t border-border pt-3">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/50">
                    <Hash className="h-3 w-3" /> {cert.verify_code}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    Cấp ngày {new Date(cert.issued_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
                <Link
                  href={`/certificates/verify/${cert.verify_code}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Xác minh
                </Link>
                <a
                  href={`/api/certificates/download/${cert.verify_code}.pdf`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" /> Tải PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/60">Bạn chưa có chứng chỉ nào.</p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Hoàn thành khóa học hoặc dự án để nhận chứng chỉ.
          </p>
        </div>
      )}
    </div>
  );
}
