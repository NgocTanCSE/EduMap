'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Clock,
  Filter,
  GraduationCap,
  Loader2,
  MapPin,
  Search,
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AuthRequiredError,
  businessService,
  type BusinessServiceItem,
} from '@/src/services/business.service';
import { authService } from '@/src/services/auth.service';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';

type ServiceRow = BusinessServiceItem & {
  businessName: string;
  businessVerified: boolean;
};

type SortOption = 'newest' | 'price-asc' | 'price-desc';

function formatPrice(value: number | string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')}đ` : 'Liên hệ';
}

function goToLogin() {
  window.location.href = `/auth/login?redirect=${encodeURIComponent('/marketplace/services')}`;
}

export default function ServiceMarketplacePage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [cartCount, setCartCount] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profiles = await businessService.getProfiles();
      const rows = profiles.flatMap((profile) =>
        (profile.services ?? []).map((service) => ({
          ...service,
          businessName: profile.name,
          businessVerified: Boolean(profile.is_verified),
        })),
      );
      setServices(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dịch vụ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (!authService.isLoggedIn()) return;
    businessService
      .getCart()
      .then((items) => setCartCount(items.reduce((sum, item) => sum + (item.quantity || 0), 0)))
      .catch(() => {
        // Cart count is a convenience; the cart page shows the real error.
      });
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          services
            .map((service) => service.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'vi')),
    [services],
  );

  const filteredServices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return services
      .filter(
        (service) =>
          category === 'all' || (service.category?.trim() || '') === category,
      )
      .filter((service) => {
        if (!needle) return true;
        return [
          service.name,
          service.description,
          service.businessName,
          service.category,
          service.location,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sort === 'price-asc') return Number(a.price) - Number(b.price);
        if (sort === 'price-desc') return Number(b.price) - Number(a.price);
        return (
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      });
  }, [services, query, category, sort]);

  const addToCart = async (service: ServiceRow) => {
    if (!authService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập để thêm dịch vụ vào giỏ hàng.');
      goToLogin();
      return;
    }

    setAddingId(service.id);
    try {
      await businessService.addToCart(service.id, 'service', 1);
      setCartCount((count) => count + 1);
      toast.success(`Đã thêm "${service.name}" vào giỏ hàng.`);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        toast.error(err.message);
        goToLogin();
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Không thể thêm vào giỏ hàng.');
    } finally {
      setAddingId(null);
    }
  };

  const hasFilters = query.trim() !== '' || category !== 'all';

  return (
    <div className="min-h-screen bg-background p-4 text-foreground sm:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <MarketplaceNav cartCount={cartCount} />

        {/* Header */}
        <div>
          <h1 className="mb-2 text-3xl font-bold">Khóa học &amp; Dịch vụ</h1>
          <p className="text-sm text-muted-foreground">
            Gia sư, tư vấn và khóa đào tạo kỹ năng từ các đối tác của EduMap.
          </p>
        </div>

        {/* Search, category and sort */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kiếm gia sư, khóa học hoặc đối tác..."
              aria-label="Tìm kiếm dịch vụ"
              className="w-full rounded-lg border border-border bg-background py-3 pl-12 pr-4 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Danh mục
            </span>
            <button
              type="button"
              aria-pressed={category === 'all'}
              onClick={() => setCategory('all')}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                category === 'all'
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}
            >
              Tất cả
            </button>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === item
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}

            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              Sắp xếp
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="newest">Mới nhất</option>
                <option value="price-asc">Giá thấp đến cao</option>
                <option value="price-desc">Giá cao đến thấp</option>
              </select>
            </label>
          </div>
        </div>

        {/* Results */}
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
          >
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={loadServices}
              className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              {services.length === 0
                ? 'Chưa có dịch vụ nào từ đối tác.'
                : 'Không tìm thấy dịch vụ phù hợp với bộ lọc.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
                className="mt-4 text-sm font-semibold text-primary hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Hiển thị {filteredServices.length} / {services.length} dịch vụ
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filteredServices.map((service) => {
                const isAdding = addingId === service.id;

                return (
                  <article
                    key={service.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50"
                  >
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-muted/20">
                      <GraduationCap className="h-20 w-20 text-muted-foreground/20 transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute left-3 top-3">
                        <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                          {service.category || 'Dịch vụ'}
                        </span>
                      </div>
                      <BookmarkButton
                        targetType="marketplace_service"
                        targetId={service.id}
                        className="absolute right-3 top-3 z-20"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <h2 className="line-clamp-2 text-sm font-bold">{service.name}</h2>
                        {service.businessVerified && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-primary"
                            title="Đối tác đã được EduMap xác minh"
                          >
                            <BadgeCheck className="h-3.5 w-3.5" /> Đã xác minh
                          </span>
                        )}
                      </div>
                      <p className="mb-4 text-[10px] text-muted-foreground">
                        {service.businessName || 'Đối tác EduMap'}
                      </p>

                      <div className="mb-5 space-y-2">
                        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                          <Tag className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                          <span className="line-clamp-2">
                            {service.description?.trim() || 'Chưa có mô tả.'}
                          </span>
                        </p>
                        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3 text-muted-foreground/50" />
                          {service.duration?.trim() || 'Thời lượng liên hệ'}
                        </p>
                        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3 text-muted-foreground/50" />
                          {service.location?.trim() || 'Hình thức liên hệ'}
                        </p>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <p className="font-mono text-sm font-bold text-primary">
                          {formatPrice(service.price)}
                        </p>
                        <button
                          type="button"
                          onClick={() => addToCart(service)}
                          disabled={isAdding}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isAdding ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShoppingCart className="h-3.5 w-3.5" />
                          )}
                          {isAdding ? 'Đang thêm...' : 'Thêm vào giỏ'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
