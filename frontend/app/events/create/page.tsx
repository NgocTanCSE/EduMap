"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Image as ImageIcon, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import FileUpload from '@/src/components/ui/FileUpload';
import { authService } from '@/src/services/auth.service';
import { eventIllustration } from '@/src/lib/illustrations';

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EVENT_TYPES = [
  { value: 'workshop', label: 'Workshop / Tập huấn' },
  { value: 'seminar', label: 'Hội thảo / Seminar' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'camp', label: 'Camp / Trại hè' },
  { value: 'conference', label: 'Hội nghị' },
  { value: 'meetup', label: 'Meetup / Giao lưu' },
  { value: 'webinar', label: 'Webinar / Trực tuyến' },
];

export default function CreateEventPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');

  const [form, setForm] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);

    return {
      title: '',
      description: '',
      type: 'workshop',
      address: '',
      start_date: toLocalInput(start),
      end_date: toLocalInput(end),
      capacity: '100',
      price: '0',
      latitude: '10.957',
      longitude: '106.843',
    };
  });

  useEffect(() => {
    if (!authService.isLoggedIn()) {
      router.replace('/auth/login?redirect=/events/create');
    }
  }, [router]);

  const preview = useMemo(
    () => bannerUrl || eventIllustration(form.type, form.title),
    [bannerUrl, form.type, form.title]
  );

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = authService.getAccessToken();
    if (!token) {
      toast.error('Vui lòng đăng nhập để tạo sự kiện');
      router.push('/auth/login?redirect=/events/create');
      return;
    }

    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Vui lòng nhập tên và mô tả sự kiện');
      return;
    }

    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error('Ngày giờ không hợp lệ');
      return;
    }
    if (end <= start) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      address: form.address.trim() || undefined,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      capacity: Math.max(1, Number(form.capacity) || 100),
      price: Math.max(0, Number(form.price) || 0),
      banner_url: bannerUrl || undefined,
    };

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      payload.latitude = latitude;
      payload.longitude = longitude;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
        throw new Error(message || 'Không thể tạo sự kiện');
      }

      const created = data?.data ?? data;
      toast.success('Đã tạo sự kiện thành công');
      router.push(created?.id ? `/events/${created.id}` : '/events');
    } catch (error: any) {
      toast.error(error.message || 'Không thể tạo sự kiện');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ContentShell className="max-w-5xl mx-auto">
      <Link
        href="/events"
        className="flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground/65 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> QUAY LẠI DANH SÁCH
      </Link>

      <SectionHeader
        title="Tạo sự kiện mới"
        subtitle="Chia sẻ workshop, hội thảo hoặc cuộc thi với cộng đồng EduMap. Ảnh bìa bạn tải lên sẽ được dùng ở danh sách và trang chi tiết."
        icon={CalendarPlus}
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                Tên sự kiện *
              </label>
              <input
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="VD: Workshop Hướng nghiệp Công nghệ 4.0"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                Mô tả *
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Giới thiệu nội dung, đối tượng tham gia và lợi ích của sự kiện..."
                rows={6}
                className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  Loại sự kiện
                </label>
                <select
                  value={form.type}
                  onChange={(e) => update('type', e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  Sức chứa
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => update('capacity', e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                Địa điểm
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="VD: Trường ĐH Lạc Hồng, Biên Hòa, Đồng Nai"
                  className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  Bắt đầu *
                </label>
                <input
                  type="datetime-local"
                  value={form.start_date}
                  onChange={(e) => update('start_date', e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  Kết thúc *
                </label>
                <input
                  type="datetime-local"
                  value={form.end_date}
                  onChange={(e) => update('end_date', e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  Giá vé (VND)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => update('price', e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  Vĩ độ
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => update('latitude', e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  Kinh độ
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => update('longitude', e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              <ImageIcon className="h-4 w-4 text-primary" /> Ảnh bìa sự kiện
            </div>
            <div className="mb-4 overflow-hidden rounded-lg border border-border">
              <img src={preview} alt="Ảnh bìa sự kiện" className="aspect-[16/9] w-full object-cover" />
            </div>
            <FileUpload
              accept=".jpg,.jpeg,.png,.webp,.gif"
              label="Tải ảnh bìa lên"
              maxSizeMB={5}
              onUploadSuccess={setBannerUrl}
            />
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/65">
              Nếu chưa tải ảnh, EduMap dùng ảnh minh họa theo loại sự kiện. Ảnh đã tải sẽ được lưu vào
              trường <code>banner_url</code> và hiển thị ở danh sách + trang chi tiết.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarPlus className="h-5 w-5" />}
            {submitting ? 'ĐANG TẠO...' : 'TẠO SỰ KIỆN'}
          </button>

          <p className="text-center text-[11px] text-muted-foreground/60">
            Bạn cần đăng nhập bằng tài khoản EduMap để tạo sự kiện.
          </p>
        </div>
      </form>
    </ContentShell>
  );
}
