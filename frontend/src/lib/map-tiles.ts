/** Cấu hình bản đồ nền (base tile) của toàn ứng dụng.

CARTO CAD là source chính, dùng style `dark_nolabels` (không có text nền nên
không có vấn đề chính trị / đặt ten cho Hoàng Sa - Trường Sa).

Khi chưa có `NEXT_PUBLIC_CARTO_API_KEY` đang set, quay lại OpenStreetMap
(tile miễn phí, mở trong repo) nhưng vẫn sẽ hiện label tiếng Trung nếu zoom
vào quần đảo.

Chỉ dùng biến môi trường `NEXT_PUBLIC_CARTO_API_KEY` (CARTO API key,
free tier 5M requests/tháng). Cần lấy tại https://carto.com/basemaps/apikey/
sau đó set biến môi trường tại Vercel (Deployment → Settings → Environment
Variables) hoặc ở seed-file `.env.local` cho local dev.
*/

/** Style không label của CARTO CAD. */
export const MAP_TILE_STYLE = 'dark_nolabels';

/** Bản đồ CARTO đã là theme tối, không cần CSS filter. Ngược lại OSM (nhạt). */
export function needsTileInvertFilter(): boolean {
    return !Boolean(process.env.NEXT_PUBLIC_CARTO_API_KEY);
}

/** Báo hiệu lúc render bản đồ ở chế độ tối (bắt OSM filterinvert). */
export function darkTileClass(): string {
    return needsTileInvertFilter() ? 'leaflet-dark-tiles' : '';
}

/** URL truy cập base tile theo chuẩn CARTO basemaps API. */
export function getTileUrl(): string {
    const key = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    if (key) {
        // r = @2x retina, `key` là tham số query của CARTO basemaps API
        return `https://{s}.basemaps.cartocdn.com/rastertiles/${MAP_TILE_STYLE}/{z}/{x}/{y}{r}.png?key=${key}`;
    }
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
}

/** Trả lời bản quyền: CARTO + OSM khi có key, chỉ OSM khi quay lại OSM. */
export function getTileAttribution(): string {
    const key = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    if (key) {
        return '© <a href="https://carto.com/attribution/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }
    return '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
}

/** Leaflet API: subdomains là 'abc' — CARTO hỗ trợ đến 'abcd'. */
export const MAP_TILE_SUBDOMAINS: string = 'abcd';
