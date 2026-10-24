'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Loader2,
  MapPin,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { marketplaceIllustration, onImageError } from '@/src/lib/illustrations';
import {
  AuthRequiredError,
  businessService,
  type CartItem,
  type CheckoutResult,
  type PaymentMethod,
} from '@/src/services/business.service';
import { authService } from '@/src/services/auth.service';
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';

type OrderInfo = CheckoutResult & { paymentStatus: string };

function formatPrice(value: number | string | null | undefined): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')}đ` : '—';
}

function goToLogin() {
  window.location.href = `/auth/login?redirect=${encodeURIComponent('/marketplace/cart')}`;
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);

    if (!authService.isLoggedIn()) {
      setAuthRequired(true);
      setLoading(false);
      return;
    }

    try {
      setCartItems(await businessService.getCart());
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setAuthRequired(true);
        return;
      }
      setError(err instanceof Error ? err.message : 'Không thể tải giỏ hàng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const calculateTotal = () =>
    cartItems.reduce((total, item) => {
      const unitPrice = item.product
        ? Number(item.product.price)
        : item.service
          ? Number(item.service.price)
          : 0;
      return total + (Number.isFinite(unitPrice) ? unitPrice : 0) * (item.quantity || 1);
    }, 0);

  const removeItem = async (id: string) => {
    setRemovingId(id);
    try {
      await businessService.removeCartItem(id);
      setCartItems((items) => items.filter((item) => item.id !== id));
      toast.success('Đã xóa mục khỏi giỏ hàng.');
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        toast.error(err.message);
        goToLogin();
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Không thể xóa mục khỏi giỏ hàng.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleCheckout = async () => {
    if (!address.trim()) {
      toast.error('Vui lòng nhập địa chỉ nhận hàng.');
      return;
    }
    if (cartItems.length === 0) return;

    setCheckingOut(true);
    try {
      const order = await businessService.checkout({
        shippingAddress: address.trim(),
        paymentMethod,
      });

      let paymentStatus = 'Thanh toán khi nhận hàng (COD)';

      if (paymentMethod === 'BANK_TRANSFER') {
        paymentStatus = 'Chờ thanh toán';
        toast.info('Đang xử lý thanh toán mô phỏng...');
        try {
          await businessService.processPayment(order.transactionId, paymentMethod);
          paymentStatus = 'Đã thanh toán (mô phỏng)';
          toast.success('Thanh toán mô phỏng thành công.');
        } catch (err) {
          paymentStatus = 'Chờ thanh toán';
          toast.warning(
            err instanceof Error
              ? `${err.message} Đơn hàng đã được ghi nhận ở trạng thái chờ thanh toán.`
              : 'Thanh toán chưa thành công. Đơn hàng đã được ghi nhận ở trạng thái chờ thanh toán.',
          );
        }
      } else {
        toast.success('Đặt hàng thành công.');
      }

      setOrderInfo({ ...order, paymentStatus });
      setCartItems([]);
      setCheckoutStep(3);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        toast.error(err.message);
        goToLogin();
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Không thể đặt hàng.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (checkoutStep === 3 && orderInfo) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground sm:p-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <MarketplaceNav />
          <div className="rounded-lg border border-border bg-card p-8 text-center sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="mt-6 text-2xl font-bold">Đặt hàng thành công!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Mã đơn hàng: <span className="font-mono text-foreground">{orderInfo.orderId}</span>
            </p>

            <dl className="mx-auto mt-6 max-w-sm space-y-3 rounded-lg border border-border bg-background p-4 text-left text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Tổng thanh toán</dt>
                <dd className="font-mono font-bold text-primary">
                  {formatPrice(orderInfo.totalAmount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Phương thức</dt>
                <dd className="font-medium">
                  {paymentMethod === 'COD' ? 'Khi nhận hàng (COD)' : 'Chuyển khoản'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Trạng thái</dt>
                <dd className="font-medium">{orderInfo.paymentStatus}</dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-muted-foreground">
              Thanh toán trong bản demo được mô phỏng, không phát sinh giao dịch thật.
            </p>

            <Link
              href="/marketplace"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Quay lại khu chợ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground sm:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <MarketplaceNav cartCount={cartCount} />

        <div className="flex items-center gap-4">
          <Link
            href="/marketplace"
            aria-label="Quay lại khu chợ"
            className="rounded-xl border border-border bg-card p-2 transition-colors hover:border-primary/50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Giỏ hàng của bạn</h1>
            {!loading && !error && !authRequired && cartItems.length > 0 && (
              <p className="text-sm text-muted-foreground">{cartCount} mục trong giỏ hàng</p>
            )}
          </div>
        </div>

        {authRequired ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <ShoppingCart className="mx-auto mb-4 h-14 w-14 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              Vui lòng đăng nhập để xem và thanh toán giỏ hàng.
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="mt-5 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Đăng nhập
            </button>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
          >
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={loadCart}
              className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Đang tải giỏ hàng...
          </div>
        ) : cartItems.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-14 text-center">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Giỏ hàng của bạn đang trống.</p>
            <Link
              href="/marketplace"
              className="mt-5 inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Bắt đầu mua sắm
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {checkoutStep === 1 ? (
                cartItems.map((item) => {
                  const product = item.product;
                  const service = item.service;
                  const name = product?.name || service?.name || 'Mục không còn khả dụng';
                  const unitPrice = product ? product.price : service?.price;
                  const isRemoving = removingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/20">
                        {product?.image_url ? (
                          <img
                            src={product.image_url}
                            alt={name}
                            onError={onImageError(marketplaceIllustration(product.category || undefined))}
                            className="h-full w-full object-cover"
                          />
                        ) : product ? (
                          <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                        ) : (
                          <GraduationCap className="h-8 w-8 text-muted-foreground/30" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-bold">{name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {product ? 'Sản phẩm' : 'Dịch vụ'} · Số lượng: {item.quantity}
                        </p>
                        <p className="mt-1 font-mono text-sm font-semibold text-primary">
                          {formatPrice(unitPrice)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={isRemoving}
                        aria-label={`Xóa ${name} khỏi giỏ hàng`}
                        className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {isRemoving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="space-y-6 rounded-lg border border-border bg-card p-6 sm:p-8">
                  <div className="space-y-4">
                    <h2 className="flex items-center gap-2 text-xl font-bold">
                      <MapPin className="h-5 w-5 text-primary" /> Thông tin nhận hàng
                    </h2>
                    <label htmlFor="shipping-address" className="sr-only">
                      Địa chỉ nhận hàng
                    </label>
                    <textarea
                      id="shipping-address"
                      placeholder="Nhập địa chỉ đầy đủ của bạn..."
                      className="h-32 w-full rounded-lg border border-border bg-background p-4 text-sm outline-none transition-colors focus:border-primary"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                    />
                  </div>

                  <div className="space-y-4">
                    <h2 className="flex items-center gap-2 text-xl font-bold">
                      <CreditCard className="h-5 w-5 text-primary" /> Phương thức thanh toán
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        aria-pressed={paymentMethod === 'COD'}
                        onClick={() => setPaymentMethod('COD')}
                        className={`rounded-lg border p-4 text-sm font-bold transition-all ${
                          paymentMethod === 'COD'
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background'
                        }`}
                      >
                        Thanh toán khi nhận hàng (COD)
                      </button>
                      <button
                        type="button"
                        aria-pressed={paymentMethod === 'BANK_TRANSFER'}
                        onClick={() => setPaymentMethod('BANK_TRANSFER')}
                        className={`rounded-lg border p-4 text-sm font-bold transition-all ${
                          paymentMethod === 'BANK_TRANSFER'
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background'
                        }`}
                      >
                        Chuyển khoản ngân hàng
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Thanh toán trong bản demo được mô phỏng, không phát sinh giao dịch thật.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="space-y-6 rounded-lg border border-border bg-card p-6 sm:p-8">
                <h2 className="text-xl font-bold">Tổng quan đơn hàng</h2>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tạm tính</span>
                    <span>{formatPrice(calculateTotal())}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phí vận chuyển</span>
                    <span className="text-primary">Miễn phí</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-end justify-between">
                    <span className="font-bold">Tổng cộng</span>
                    <span className="font-mono text-2xl font-bold text-primary">
                      {formatPrice(calculateTotal())}
                    </span>
                  </div>
                </div>

                {checkoutStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => setCheckoutStep(2)}
                    className="w-full rounded-lg bg-primary py-4 font-bold text-primary-foreground transition-colors hover:bg-primary/80"
                  >
                    Tiến hành đặt hàng
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleCheckout}
                      disabled={checkingOut}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-bold text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-60"
                    >
                      {checkingOut && <Loader2 className="h-4 w-4 animate-spin" />}
                      {checkingOut ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutStep(1)}
                      disabled={checkingOut}
                      className="w-full rounded-lg bg-muted py-4 font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                    >
                      Quay lại giỏ hàng
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
