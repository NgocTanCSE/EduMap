import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export interface Event {
    id: string;
    title: string;
    description: string;
    type?: string;
    location: string;
    address?: string;
    start_date: string;
    end_date: string;
    capacity: number;
    registered_count: number;
    organizer_id: string;
    status: string;
    image_url?: string;
    created_at: string;
}
export interface EventRegistrationResponse {
    message: string;
    event_title: string;
    ticket_code: string;
    ticket_qr: string;
    start_date: string;
    location: string;
    address?: string;
}
export function formatEventLocation(value: any): string {
    if (!value)
        return '';
    if (typeof value === 'string') {
        return value.trim();
    }
    if (Array.isArray(value) && value.length >= 2) {
        const lng = Number(value[0]);
        const lat = Number(value[1]);
        return Number.isFinite(lat) && Number.isFinite(lng)
            ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : '';
    }
    if (typeof value === 'object') {
        for (const key of ['address', 'name', 'label', 'display_name']) {
            const candidate = value[key];
            if (typeof candidate === 'string' && candidate.trim()) {
                return candidate.trim();
            }
        }
        const coords = Array.isArray(value.coordinates) ? value.coordinates : null;
        if (coords && coords.length >= 2) {
            const lng = Number(coords[0]);
            const lat = Number(coords[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            }
        }
    }
    return '';
}
class EventsService {
    private readonly API_URL = '/api/events';
    private normalizeEvent(raw: any): Event {
        if (!raw || typeof raw !== 'object')
            return raw;
        return {
            ...raw,
            location: formatEventLocation(raw.address || raw.location),
            address: raw.address ?? undefined,
            image_url: raw.image_url || raw.banner_url || undefined,
        };
    }
    async getAllEvents(): Promise<Event[]> {
        try {
            const response = await fetchWithRetry(this.API_URL);
            if (response.status === 404) {
                return [];
            }
            if (!response.ok) {
                throw new Error('Không thể tải danh sách sự kiện');
            }
            const payload = await response.json();
            const list = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];
            return list.map((event: any) => this.normalizeEvent(event));
        }
        catch (error) {
            console.error("EventsService.getAllEvents Error:", error);
            throw error;
        }
    }
    async getEventById(id: string): Promise<Event> {
        try {
            const response = await fetchWithRetry(`${this.API_URL}/${id}`);
            if (!response.ok) {
                if (response.status === 404)
                    throw new Error('Sự kiện không tồn tại');
                throw new Error('Không thể tải thông tin sự kiện');
            }
            const payload = await response.json();
            return this.normalizeEvent(payload?.data ?? payload);
        }
        catch (error) {
            console.error(`EventsService.getEventById(${id}) Error:`, error);
            throw error;
        }
    }
    async registerEvent(eventId: string): Promise<EventRegistrationResponse> {
        const token = authService.getAccessToken();
        if (!token) {
            throw new Error('Vui lòng đăng nhập để đăng ký tham gia sự kiện');
        }
        try {
            const response = await fetchWithRetry(`${this.API_URL}/${eventId}/register`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Đăng ký sự kiện thất bại');
            }
            return {
                ...data,
                address: data?.address,
                location: formatEventLocation(data?.address || data?.location),
            };
        }
        catch (error) {
            console.error("EventsService.registerEvent Error:", error);
            throw error;
        }
    }

    async createEvent(eventData: Record<string, unknown>) {
        const token = authService.getAccessToken();
        if (!token)
            throw new Error('Vui lòng đăng nhập để tạo sự kiện');
        const response = await fetchWithRetry(this.API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
            throw new Error(message || 'Không thể tạo sự kiện');
        }
        const raw = await response.json();
        return this.normalizeEvent(raw?.data ?? raw);
    }
}
export const eventsService = new EventsService();
