/** Cấu hình bản đồ nền (base tile) của toàn ứng dụng.

CARTO basemaps API (style `voyager`) — nền màu, đầy đủ nhãn tên đường/phường/
thành phố, giao diện gần giống Google Maps. Dữ liệu Carto **không** ghi nhận
tên tiếng Trung cho Hoàng Sa - Trường Sa (trái ngược OpenStreetMap).

Khi `NEXT_PUBLIC_CARTO_API_KEY` đã set: request bao gồm `key=KEY`.
Khi chưa set: request không key (CARTO trả tile + ghi chú "API key required"
trên tile; bản đồ vẫn sạch nhãn Trung Quốc).

Chỉ dùng biến môi trường `NEXT_PUBLIC_CARTO_API_KEY` (CARTO API key,
free tier 5M requests/tháng). Cần lấy tại https://carto.com/basemaps/apikey/
sau đó set biến môi trường tại Vercel (Deployment → Settings → Environment
Variables) hoặc ở seed-file `.env.local` cho local dev.

Bất kỳ `TileLayer` nào cũng phải dùng `getTileUrl()` + `getTileAttribution()`;
tuyệt đối không hardcode URL tile khác.
*/

/** Style vốn màu, đầy đủ nhãn (như Google Maps). */
export const MAP_TILE_STYLE = 'voyager';

/** Subdomain CARTO hỗ trợ cho Leaflet. */
export const MAP_TILE_SUBDOMAINS: string = 'abcd';

/** URL truy cập base tile theo chuẩn CARTO basemaps API. */
export function getTileUrl(): string {
    const key = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    if (key) {
        // r = @2x retina, `key` là tham số query của CARTO basemaps API
        return `https://{s}.basemaps.cartocdn.com/rastertiles/${MAP_TILE_STYLE}/{z}/{x}/{y}{r}.png?key=${key}`;
    }
    // Không có key: CARTO trả về tile + ghi chú "API key required",
    // tuyệt đối không quay lại OSM (nhãn tiếng Trung ở Hoàng Sa/Trường Sa).
    return `https://{s}.basemaps.cartocdn.com/rastertiles/${MAP_TILE_STYLE}/{z}/{x}/{y}.png`;
}

/** Trả lời bản quyền: CARTO + OSM (Data is based on OSM). */
export function getTileAttribution(): string {
    return '© <a href="https://carto.com/attribution/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
}
