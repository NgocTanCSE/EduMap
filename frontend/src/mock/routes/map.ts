/* Map + geo routes for the frontend mock layer. */
import { fail, haversineKm, nowIso, num, ok, uid, type MockRoute } from '../core';
import {
    buildClimateAlternatives,
    buildClimateRisk,
    buildDataGaps,
    buildGapForecast,
    buildNlSearch,
    buildResourceOptimization,
    buildRouteExplain,
    buildSurveyPriorities,
    buildVisionDetect,
} from '../ai';

function toLocation(poi: Record<string, any>) {
    return {
        id: poi.id,
        name: poi.name,
        category: poi.category,
        lat: num(poi.lat),
        lng: num(poi.lng),
        description: poi.description,
        address: poi.address,
        rating_avg: poi.rating_avg,
        rating_count: poi.rating_count,
        source: poi.source,
        verified: poi.verified,
    };
}

function insideBounds(poi: Record<string, any>, ctx: any) {
    const minLat = ctx.query.get('minLat');
    const maxLat = ctx.query.get('maxLat');
    const minLng = ctx.query.get('minLng');
    const maxLng = ctx.query.get('maxLng');
    if (minLat === null || maxLat === null || minLng === null || maxLng === null) return true;
    return (
        num(poi.lat) >= num(minLat) &&
        num(poi.lat) <= num(maxLat) &&
        num(poi.lng) >= num(minLng) &&
        num(poi.lng) <= num(maxLng)
    );
}

function routeGeometry(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }, bend = 0.0008) {
    const midLat = (origin.lat + dest.lat) / 2 + bend;
    const midLng = (origin.lng + dest.lng) / 2 - bend;
    const coords = [
        [origin.lng, origin.lat],
        [origin.lng + (midLng - origin.lng) * 0.5, origin.lat + (midLat - origin.lat) * 0.8],
        [midLng, midLat],
        [dest.lng + (midLng - dest.lng) * 0.35, dest.lat + (midLat - dest.lat) * 0.6],
        [dest.lng, dest.lat],
    ];
    return { type: 'LineString', coordinates: coords };
}

function straightDistanceKm(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }) {
    return haversineKm(origin.lat, origin.lng, dest.lat, dest.lng) * 1.27;
}

export const mapRoutes: MockRoute[] = [
    {
        method: 'GET',
        path: '/api/map/stats',
        handler: (ctx) => {
            const categories: Record<string, number> = {};
            ctx.db.pois.forEach((p) => {
                categories[p.category] = (categories[p.category] || 0) + 1;
            });
            return ok({
                total_pois: ctx.db.pois.length,
                total_locations: ctx.db.pois.length,
                categories,
                users: ctx.db.adminUsers.length,
                scholarships: ctx.db.scholarships.length,
                jobs: ctx.db.jobs.length,
                updated_at: nowIso(),
            });
        },
    },
    {
        method: 'GET',
        path: '/api/map/categories',
        handler: (ctx) => {
            const categories = Array.from(new Set(ctx.db.pois.map((p) => String(p.category)))).sort();
            return ok(categories);
        },
    },
    {
        method: 'GET',
        path: '/api/map/pois',
        handler: (ctx) => {
            const category = ctx.query.get('category');
            const q = String(ctx.query.get('q') || '').trim().toLowerCase();
            const items = ctx.db.pois
                .filter((p) => (!category || category === 'all' ? true : p.category === category))
                .filter((p) => insideBounds(p, ctx))
                .filter((p) => (!q ? true : `${p.name} ${p.address} ${p.description}`.toLowerCase().includes(q)))
                .map(toLocation);
            return ok(items);
        },
    },
    {
        method: 'POST',
        path: '/api/map/pois',
        handler: (ctx) => {
            if (!ctx.user) return fail(401, 'Vui lòng đăng nhập để ghim vị trí.');
            const poi = {
                id: uid('poi'),
                name: String(ctx.body?.name || 'Địa điểm mới'),
                category: String(ctx.body?.category || 'school'),
                lat: num(ctx.body?.lat),
                lng: num(ctx.body?.lng),
                address: String(ctx.body?.address || ''),
                description: String(ctx.body?.description || ''),
                rating_avg: 0,
                rating_count: 0,
                source: 'Cộng đồng EduMap',
                verified: false,
                created_by: ctx.user.id,
                created_at: nowIso(),
            };
            if (!poi.lat || !poi.lng) return fail(400, 'Toạ độ không hợp lệ.');
            ctx.db.pois.unshift(poi);
            return ok({ message: 'Đã ghim vị trí thành công.', ...toLocation(poi) });
        },
    },
    {
        method: 'GET',
        path: '/api/map/locations',
        handler: (ctx) =>
            ok(
                ctx.db.learningSpots.map((spot) => {
                    const coords = spot.location?.coordinates || [106.8186, 10.9576];
                    return {
                        id: spot.id,
                        name: spot.name,
                        category: spot.type,
                        lat: num(coords[1]),
                        lng: num(coords[0]),
                        description: spot.description,
                        address: spot.address,
                        rating_avg: spot.rating_avg,
                    };
                }),
            ),
    },
    {
        method: 'GET',
        path: '/api/map/featured-pins',
        handler: (ctx) => ok(ctx.db.featuredPins),
    },
    {
        method: 'POST',
        path: '/api/map/ai-analysis',
        handler: (ctx) => {
            const region = String(ctx.body?.query || 'Biên Hòa');
            const features = ctx.db.pois.slice(0, 20).map((p) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                properties: { id: p.id, name: p.name, category: p.category, density: 0.7 },
            }));
            return ok({
                density_score: 68.4,
                summary:
                    `Khu vực ${region} có mật độ điểm giáo dục tương đối cao ở trung tâm, nhưng thưa dần về phía Trảng Dài và Tân Tiến. ` +
                    'Nhóm trường đại học và thư viện tập trung trong bán kính 3 km, trong khi phòng lab và không gian STEM còn thiếu.',
                recommendations: [
                    'Bổ sung 2 phòng lab STEM tại khu vực Trảng Dài.',
                    'Mở rộng giờ phục vụ thư viện vào buổi tối.',
                    'Cập nhật toạ độ và giờ mở cửa cho 5 địa điểm chưa kiểm chứng.',
                ],
                geojson: { type: 'FeatureCollection', features },
                degraded: false,
            });
        },
    },
    {
        method: 'GET',
        path: '/api/map/nl-search',
        handler: (ctx) => ok(buildNlSearch(ctx.db, String(ctx.query.get('q') || ''))),
    },
    {
        method: 'GET',
        path: '/api/map/nls-search',
        handler: (ctx) => {
            const q = String(ctx.query.get('q') || '');
            const result = buildNlSearch(ctx.db, q);
            return ok({
                ...result,
                total: result.results.length,
                items: result.results,
                results: result.results,
            });
        },
    },
    {
        method: 'GET',
        path: '/api/map/data-gaps',
        handler: (ctx) => ok(buildDataGaps(ctx.db, ctx.query.get('category') || undefined)),
    },
    {
        method: 'GET',
        path: '/api/map/gap-forecast',
        handler: (ctx) => ok(buildGapForecast(ctx.db, num(ctx.query.get('grid_size_km'), 2))),
    },
    {
        method: 'GET',
        path: '/api/map/resource-optimization',
        handler: (ctx) => ok(buildResourceOptimization(ctx.db, num(ctx.query.get('budget'), 30000000))),
    },
    {
        method: 'GET',
        path: '/api/map/survey/priorities',
        handler: (ctx) => ok(buildSurveyPriorities(ctx.db, num(ctx.query.get('top_n'), 10))),
    },
    {
        method: 'GET',
        path: '/api/map/survey/next',
        handler: (ctx) => {
            const result = buildSurveyPriorities(ctx.db, 5);
            return ok({ next_point: result.next_point, candidates: result.features, metadata: result.metadata });
        },
    },
    {
        method: 'GET',
        path: '/api/map/climate-risk',
        handler: (ctx) => ok(buildClimateRisk(ctx.db)),
    },
    {
        method: 'POST',
        path: '/api/map/climate/alternatives',
        handler: (ctx) => ok(buildClimateAlternatives(ctx.db)),
    },
    {
        method: 'POST',
        path: '/api/geo/vision-detect',
        handler: (ctx) => {
            const rawBbox = Array.isArray(ctx.body?.bbox) ? ctx.body.bbox : null;
            const bbox: [number, number, number, number] = rawBbox && rawBbox.length === 4
                ? [num(rawBbox[0], 106.84), num(rawBbox[1], 10.95), num(rawBbox[2], 106.86), num(rawBbox[3], 10.97)]
                : [106.8408, 10.9538, 106.8498, 10.9628];
            const lat = (bbox[1] + bbox[3]) / 2;
            const lng = (bbox[0] + bbox[2]) / 2;
            const labels = Array.isArray(ctx.body?.labels)
                ? ctx.body.labels.map((label: unknown) => String(label)).filter(Boolean)
                : [];
            return ok(buildVisionDetect(ctx.db, lat, lng, bbox, labels));
        },
    },
    {
        method: 'GET',
        path: '/api/map/routing/route',
        handler: (ctx) => {
            const origin = { lat: num(ctx.query.get('lat1'), 10.9576), lng: num(ctx.query.get('lng1'), 106.8186) };
            const dest = { lat: num(ctx.query.get('lat2'), 10.9753), lng: num(ctx.query.get('lng2'), 106.8452) };
            const distanceKm = straightDistanceKm(origin, dest);
            const durationSeconds = Math.round((distanceKm / 24) * 3600);
            const primary = {
                geometry: routeGeometry(origin, dest),
                duration: durationSeconds,
                distance: Math.round(distanceKm * 1000),
                isPrimary: true,
                summary: 'Tuyến chính',
            };
            const alternative = {
                geometry: routeGeometry(origin, dest, -0.0012),
                duration: durationSeconds + 240,
                distance: Math.round(distanceKm * 1000 * 1.12),
                isPrimary: false,
                summary: 'Tuyến tránh ùn tắc',
            };
            const segments = [
                { name: 'Đường Nguyễn Khuyến', distance: Math.round(distanceKm * 400), duration: Math.round(durationSeconds * 0.45), instruction: 'Đi thẳng theo hướng trung tâm' },
                { name: 'Đường Đồng Khởi', distance: Math.round(distanceKm * 400), duration: Math.round(durationSeconds * 0.4), instruction: 'Rẽ trái tại ngã tư' },
                { name: 'Đường Trảng Dài', distance: Math.round(distanceKm * 200), duration: Math.round(durationSeconds * 0.15), instruction: 'Đến điểm đích bên phải' },
            ];
            return ok({
                routes: ctx.query.get('alternatives') === 'true' ? [primary, alternative] : [primary],
                segments,
                floodWarnings: [
                    { road: 'Đường Đồng Khởi', risk: 0.62, note: 'Ngập cục bộ sau mưa lớn' },
                ],
                avoidedFloodZones: [{ name: 'Vùng trũng Tân Tiến', risk: 0.71 }],
                trafficAnalysis: { congestion_level: 'medium', peak_hours: ['07:00–08:30', '17:00–18:30'] },
                provider: 'edumap-mock',
                estimated: false,
            });
        },
    },
    {
        method: 'GET',
        path: '/api/map/safe-route',
        handler: (ctx) => {
            const origin = { lat: num(ctx.query.get('lat1'), 10.9576), lng: num(ctx.query.get('lng1'), 106.8186) };
            const dest = { lat: num(ctx.query.get('lat2'), 10.9753), lng: num(ctx.query.get('lng2'), 106.8452) };
            const distanceKm = straightDistanceKm(origin, dest);
            const routes = [0, 1].map((idx) => {
                const duration = Math.round((distanceKm / (idx === 0 ? 24 : 21)) * 3600);
                return {
                    geometry: routeGeometry(origin, dest, idx === 0 ? 0.0008 : -0.0012),
                    duration,
                    distance: Math.round(distanceKm * 1000 * (idx === 0 ? 1 : 1.12)),
                    safetyScore: idx === 0 ? 87 : 74,
                    safetyFactors: {
                        flood_risk: idx === 0 ? 0.12 : 0.28,
                        traffic_risk: idx === 0 ? 0.22 : 0.18,
                        lighting: 0.8,
                    },
                    explanation: idx === 0 ? 'Tuyến an toàn nhất, tránh vùng ngập Tân Tiến.' : 'Tuyến ngắn hơn nhưng đi qua điểm ngập nhẹ.',
                    isPrimary: idx === 0,
                    floodWarnings: idx === 0 ? [] : [{ road: 'Đường Đồng Khởi', risk: 0.55 }],
                    trafficAnalysis: { congestion_level: idx === 0 ? 'low' : 'medium' },
                };
            });
            return ok({ routes, estimated: false, provider: 'edumap-mock' });
        },
    },
    {
        method: 'POST',
        path: '/api/ai/route/explain',
        handler: (ctx) => ok(buildRouteExplain(ctx.body?.routes, ctx.body?.preferences)),
    },
];
