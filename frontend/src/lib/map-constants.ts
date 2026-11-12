/** Cấu hình bản đồ nền (base tile) + hằng số bản đồ.

Các điểm vị trí (POI) của bản đồ đến từ backend (bảng `map_points`):
- `/api/map/pois` → `GET /map/pois` trả về dữ liệu đã crawl vào DB.
- `/api/map/categories` → danh mục tìm kiếm.

Chỉ dùng biến môi trường `NEXT_PUBLIC_CARTO_API_KEY` (CARTO API key,
free tier 5M requests/tháng). Cần lấy tại https://carto.com/basemaps/apikey/
sau đó set biến môi trường tại Vercel (Deployment → Settings → Environment
Variables) hoặc ở seed-file `.env.local` cho local dev.

Bất kỳ `TileLayer` nào cũng phải dùng `getTileUrl()` + `getTileAttribution()`;
tuyệt đối không hardcode URL tile khác (bản đồ đều dùng `MapComponent` ở
`components/ui/MapComponent.tsx` và `app/map/page.tsx`).
*/

/** Styles hiện màu, đầy đủ nhãn (như Google Maps). */
export const MAP_TILE_STYLE = 'voyager';

/** Subdomain CARTO hỗ trợ cho Leaflet. */
export const MAP_TILE_SUBDOMAINS: string = 'abcd';

/** Trả về URL truy cập base tile theo chuẩn CARTO basemaps API. */
export function getTileUrl(): string {
    const key = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    if (key) {
        // r = @2x retina, `key` là tham số query của CARTO basemaps API.
        return `https://{s}.basemaps.cartocdn.com/rastertiles/${MAP_TILE_STYLE}/{z}/{x}/{y}{r}.png?key=${key}`;
    }
    // Không có key: CARTO trả về tile + ghi chú "API key required".
    return `https://{s}.basemaps.cartocdn.com/rastertiles/${MAP_TILE_STYLE}/{z}/{x}/{y}.png`;
}

/** Trả lời bản quyền: CARTO basemaps. */
export function getTileAttribution(): string {
    return '© <a href="https://carto.com/attribution/">CARTO</a> contributors';
}

/** Danh mục chuyên biệt hóa bản đồ (giá trị mặc định khi backend chưa sẵn có). */
export const DEFAULT_CATEGORIES = [
    'university', 'school', 'library', 'wifi', 'cafe',
    'restaurant', 'park', 'green', 'market', 'convenience',
];

/** bounding box mặc định (Biên Hòa) khi các tham số bbox không có trên URL. */
export const DEFAULT_BBOX = { minLat: 10.8, maxLat: 11.2, minLng: 106.5, maxLng: 107.0 };

export function bboxFromParams(sp: URLSearchParams) {
    const minLat = sp.get('minLat');
    const maxLat = sp.get('maxLat');
    const minLng = sp.get('minLng');
    const maxLng = sp.get('maxLng');
    if (minLat && maxLat && minLng && maxLng) {
        return { minLat: +minLat, maxLat: +maxLat, minLng: +minLng, maxLng: +maxLng };
    }
    return DEFAULT_BBOX;
}
