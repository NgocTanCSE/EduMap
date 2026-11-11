/** Cấu hình bản đồ nền (base tile) của toàn ứng dụng.

CARTO CAD là source chính, dùng style `dark_nolabels` (không có text nền nên
không có vấn đề chính trị / đặt tên cho Hoàng Sa - Trường Sa).

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

/** Thuật ngữ + video truy cập base tile. */
export function getTileUrl(): string {
    const key = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    if (key) {
        // r = @2x retina, api_key là công thức theo CARTO sử dụng
        return `https://{s}.basemaps.cartocdn.com/${MAP_TILE_STYLE}/{z}/{x}/{y}{r}.png?api_key=${key}`;
    }
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
}

/** Bằng nội dung CARTO CAD (gần hết) khi key đang có, còn lại là OSM. */
export function getTileAttribution(): string {
    const key = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    if (key) {
        return '&copy; <a href="https://carto.com/about/" target="_blank">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
}
