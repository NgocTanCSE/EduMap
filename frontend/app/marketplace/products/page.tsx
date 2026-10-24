'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Filter,
  Loader2,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { marketplaceIllustration, onImageError } from '@/src/lib/illustrations';
import {
  AuthRequiredError,
  businessService,
  type BusinessProduct,
} from '@/src/services/business.service';
import { authService } from '@/src/services/auth.service';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';

type ProductRow = BusinessProduct & {
  businessName: string;
  businessVerified: boolean;
};

type SortOption = 'newest' | 'price-asc' | 'price-desc';

function formatPrice(value: number | string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')}đ` : 'Liên hệ';
}

function goToLogin() {
  window.location.href = `/auth/login?redirect=${encodeURIComponent('/marketplace/products')}`;
}

export default function ProductMarketplacePage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [cartCount, setCartCount] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profiles = await businessService.getProfiles();
      const rows = profiles.flatMap((profile) =>
        (profile.products ?? []).map((product) => ({
          ...product,
          businessName: profile.name,
          businessVerified: Boolean(profile.is_verified),
        })),
      );
      setProducts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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
          products
            .map((product) => product.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'vi')),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products
      .filter(
        (product) =>
          category === 'all' || (product.category?.trim() || '') === category,
      )
      .filter((product) => {
        if (!needle) return true;
        return [product.name, product.description, product.businessName, product.category]
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
  }, [products, query, category, sort]);

  const addToCart = async (product: ProductRow) => {
    if (!authService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
      goToLogin();
      return;
    }

    setAddingId(product.id);
    try {
      await businessService.addToCart(product.id, 'product', 1);
      setCartCount((count) => count + 1);
      toast.success(`Đã thêm "${product.name}" vào giỏ hàng.`);
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
          <h1 className="mb-2 text-3xl font-bold">Văn phòng phẩm &amp; Thiết bị</h1>
          <p className="text-sm text-muted-foreground">
            Dụng cụ học tập từ các đối tác của EduMap. Giá và tồn kho hiển thị theo dữ liệu
            đối tác cung cấp.
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
              placeholder="Tìm kiếm dụng cụ, thiết bị hoặc đối tác..."
              aria-label="Tìm kiếm sản phẩm"
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
              onClick={loadProducts}
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
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center">
            <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              {products.length === 0
                ? 'Chưa có sản phẩm nào từ đối tác.'
                : 'Không tìm thấy sản phẩm phù hợp với bộ lọc.'}
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
              Hiển thị {filteredProducts.length} / {products.length} sản phẩm
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filteredProducts.map((product) => {
                const stock = typeof product.stock === 'number' ? product.stock : null;
                const outOfStock = stock !== null && stock <= 0;
                const isAdding = addingId === product.id;

                return (
                  <article
                    key={product.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50"
                  >
                    <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted/20">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          onError={onImageError(marketplaceIllustration(product.category || undefined))}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <ShoppingBag className="h-20 w-20 text-muted-foreground/20 transition-transform duration-700 group-hover:scale-105" />
                      )}
                      <div className="absolute left-3 top-3">
                        <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                          {product.category || 'Dụng cụ'}
                        </span>
                      </div>
                      <BookmarkButton
                        targetType="marketplace_product"
                        targetId={product.id}
                        className="absolute right-3 top-3 z-20"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <h2 className="line-clamp-2 text-sm font-bold">{product.name}</h2>
                        {product.businessVerified && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-primary"
                            title="Đối tác đã được EduMap xác minh"
                          >
                            <BadgeCheck className="h-3.5 w-3.5" /> Đã xác minh
                          </span>
                        )}
                      </div>
                      <p className="mb-4 text-[10px] text-muted-foreground">
                        {product.businessName || 'Đối tác EduMap'}
                      </p>

                      <div className="mb-5 space-y-2">
                        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                          <Tag className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                          <span className="line-clamp-2">
                            {product.description?.trim() || 'Chưa có mô tả.'}
                          </span>
                        </p>
                        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Package className="h-3 w-3 text-muted-foreground/50" />
                          {stock === null
                            ? 'Sẵn có'
                            : stock > 0
                              ? `Còn ${stock} sản phẩm`
                              : 'Hết hàng'}
                        </p>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <p className="font-mono text-sm font-bold text-primary">
                          {formatPrice(product.price)}
                        </p>
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={outOfStock || isAdding}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isAdding ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShoppingCart className="h-3.5 w-3.5" />
                          )}
                          {outOfStock ? 'Hết hàng' : isAdding ? 'Đang thêm...' : 'Thêm vào giỏ'}
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
