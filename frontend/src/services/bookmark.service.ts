import { authService } from '@/src/services/auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export type Bookmark = {
  target_type: string;
  target_id: string;
  /** title resolved server-side when the target table is joinable (NULL otherwise). */
  title: string | null;
  created_at: string;
};

/** Nhỏ gọn, đúng chuẩn fetchWithAuth của repo (`dashboard.service.ts`). */
async function fetchWithAuth(
  input: string,
  init: RequestInit = {},
  fallbackMessage = 'Không thể xử lý yêu cầu đánh dấu',
) {
  const token = authService.getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  };
  const res = await fetchWithRetry(input, { ...init, headers });
  if (!res.ok) {
    // Keep the UI copy Vietnamese; the HTTP status is enough context here.
    throw new Error(`${fallbackMessage} (${res.status})`);
  }
  return unwrapApiResponse<any>(await res.json());
}

export const bookmarkService = {
  /** GET /api/bookmarks — trả về { items: Bookmark[] } (đã join title). */
  list: (): Promise<{ items: Bookmark[] }> =>
    fetchWithAuth('/api/bookmarks', {}, 'Không thể tải mục đã lưu'),

  /** POST /api/bookmarks — toggle. */
  toggle: (target_type: string, target_id: string): Promise<{ bookmarked: boolean }> =>
    fetchWithAuth(
      '/api/bookmarks',
      {
        method: 'POST',
        body: JSON.stringify({ target_type, target_id }),
      },
      'Không thể cập nhật mục đã lưu',
    ),
};

const LABEL: Record<string, string> = {
  poi: 'Điểm bản đồ',
  job: 'Việc làm',
  event: 'Sự kiện',
  opportunity: 'Cơ hội',
  internships: 'Thực tập',
  scholarships: 'Học bổng',
  lab: 'Laboratory',
  community_post: 'Bài viết',
  marketplace_product: 'Sản phẩm',
  marketplace_service: 'Dịch vụ',
  shared_item: 'Tài liệu chia sẻ',
  library_item: 'Tài liệu',
  mentor: 'Cố vấn',
  donate_campaign: 'Chiến dịch',
  green: 'Điểm xanh',
  wifi: 'Wifi',
  summer: 'Mùa hè',
  hackathon: 'Hackathon',
};

/** Label hiển thị cho target_type (dùng ở dashboard và BookmarkButton context). */
export function bookmarkLabel(type: string): string {
  return LABEL[type] ?? type;
}

/** Route "Chi tiết" cho một target_type (dùng để link từ trang Đã lưu). */
export function targetUrl(type: string, id: string): string | null {
  const MAP: Record<string, (id: string) => string> = {
    poi: () => '/map',
    job: (id) => `/career/jobs/${id}`,
    event: (id) => `/events/${id}`,
    opportunity: (id) => `/opportunities/${id}`,
    internships: (id) => `/internships/${id}`,
    scholarships: (id) => `/scholarships/${id}`,
    community_post: (id) => `/community/post/${id}`,
    marketplace_product: () => '/marketplace/products',
    marketplace_service: () => '/marketplace/services',
    shared_item: () => '/marketplace',
    library_item: () => '/library',
    mentor: (id) => `/mentor/${id}`,
    donate_campaign: (id) => `/donate/campaign/${id}`,
    green: () => '/green',
    wifi: () => '/wifi',
    summer: () => '/summer',
    hackathon: (id) => `/hackathon/${id}`,
    lab: () => '/stem',
  };
  const fn = MAP[type];
  return fn ? fn(id) : null;
}
