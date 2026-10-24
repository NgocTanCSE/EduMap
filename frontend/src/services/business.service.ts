import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export type PaymentMethod = 'COD' | 'BANK_TRANSFER';

export interface BusinessReview {
  id: string;
  rating: number;
  comment?: string | null;
}

export interface BusinessProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  currency?: string;
  category?: string | null;
  stock?: number;
  image_url?: string | null;
  businessProfileId: string;
  reviews?: BusinessReview[];
  created_at?: string;
}

export interface BusinessServiceItem {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  currency?: string;
  category?: string | null;
  duration?: string | null;
  location?: string | null;
  businessProfileId: string;
  reviews?: BusinessReview[];
  created_at?: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  description?: string | null;
  industry?: string | null;
  website?: string | null;
  logo_url?: string | null;
  is_verified?: boolean;
  products?: BusinessProduct[];
  services?: BusinessServiceItem[];
}

export interface CartItem {
  id: string;
  quantity: number;
  productId?: string | null;
  serviceId?: string | null;
  product?: BusinessProduct | null;
  service?: BusinessServiceItem | null;
}

export interface CheckoutResult {
  message: string;
  orderId: string;
  transactionId: string;
  totalAmount: number;
}

/** Raised when an authenticated marketplace action has no valid session. */
export class AuthRequiredError extends Error {
  constructor(message = 'Vui lòng đăng nhập để tiếp tục.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

type RequestOptions = {
  /** Require an access token before sending the request. */
  auth?: boolean;
  /** Disable retries for non-idempotent mutations (cart add, checkout...). */
  retry?: boolean;
  fallback?: string;
};

function errorMessage(payload: unknown, fallback: string): string {
  const data = payload as { message?: unknown; error?: unknown } | null;
  const raw = data?.message ?? data?.error;
  if (Array.isArray(raw)) return raw.filter(Boolean).join(', ') || fallback;
  return typeof raw === 'string' && raw.trim() ? raw : fallback;
}

class BusinessService {
  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<T> {
    const token = authService.getAccessToken();
    if (options.auth && !token) throw new AuthRequiredError();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const requestInit: RequestInit = { ...init, headers };
    const response =
      options.retry === false
        ? await fetch(path, requestInit)
        : await fetchWithRetry(path, requestInit);

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthRequiredError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }
      throw new Error(
        errorMessage(payload, options.fallback || 'Không thể xử lý yêu cầu. Vui lòng thử lại.'),
      );
    }

    return unwrapApiResponse<T>(payload);
  }

  /** Public list of business profiles, each with its products and services. */
  async getProfiles(): Promise<BusinessProfile[]> {
    const data = await this.request<BusinessProfile[] | null>('/api/business', {}, {
      retry: true,
      fallback: 'Không thể tải danh sách sản phẩm và dịch vụ.',
    });
    return Array.isArray(data) ? data : [];
  }

  async getCart(): Promise<CartItem[]> {
    const data = await this.request<CartItem[] | null>('/api/business/cart', {}, {
      auth: true,
      retry: true,
      fallback: 'Không thể tải giỏ hàng.',
    });
    return Array.isArray(data) ? data : [];
  }

  async addToCart(
    itemId: string,
    itemType: 'product' | 'service',
    quantity = 1,
  ): Promise<unknown> {
    return this.request('/api/business/cart', {
      method: 'POST',
      body: JSON.stringify({ itemId, itemType, quantity }),
    }, {
      auth: true,
      retry: false,
      fallback: 'Không thể thêm vào giỏ hàng.',
    });
  }

  async removeCartItem(cartItemId: string): Promise<unknown> {
    return this.request(`/api/business/cart/${cartItemId}`, { method: 'DELETE' }, {
      auth: true,
      retry: false,
      fallback: 'Không thể xóa mục khỏi giỏ hàng.',
    });
  }

  async checkout(payload: {
    shippingAddress: string;
    paymentMethod: PaymentMethod;
  }): Promise<CheckoutResult> {
    return this.request<CheckoutResult>('/api/business/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, {
      auth: true,
      retry: false,
      fallback: 'Không thể đặt hàng.',
    });
  }

  async processPayment(transactionId: string, paymentMethod: PaymentMethod): Promise<unknown> {
    return this.request(`/api/payment/process/${transactionId}`, {
      method: 'POST',
      body: JSON.stringify({ method: paymentMethod }),
    }, {
      auth: true,
      retry: false,
      fallback: 'Thanh toán chưa thành công.',
    });
  }
}

export const businessService = new BusinessService();
