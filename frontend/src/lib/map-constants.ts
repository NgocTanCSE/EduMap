/**
 * Shared helpers for the map POI BFF routes.
 * Lives outside `app/api/*` so Next Route-types never choke on non-handler
 * exports.
 */

// Overpass public instances (primary + fallback for resilience against rate limits)
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Default viewport = Biên Hòa city + small buffer — matches map defaultCenter [10.957,106.843].
// A larger bbox times out on Overpass (too many elements); city-scale is fast.
export const DEFAULT_BBOX = { minLat: 10.8, maxLat: 11.2, minLng: 106.5, maxLng: 107.0 };

// frontend category chip -> Overpass [tagKey, valueRegex][]
export const CAT_SELECTORS: Record<string, Array<[string, string]>> = {
  university:   [['amenity', '^(university|college|polytechnic)$'], ['building', '^(university|college)$']],
  school:       [['amenity', '^school$'], ['building', '^school$']],
  library:      [['amenity', '^library$']],
  wifi:         [['amenity', '^wifi$'], ['wifi', '^yes$'], ['access:wifi', '^yes$']],
  cafe:         [['amenity', '^cafe$'], ['shop', '^(cafe|coffee)$']],
  restaurant:   [['amenity', '^(restaurant|fast_food)$']],
  market:       [['shop', '^supermarket$']],
  convenience:  [['shop', '^convenience$']],
  green:        [['leisure', '^(park|garden|common)$'], ['natural', '^(wood|grassland|wetland)$'], ['landuse', '^(forest|meadow|grass)$']],
  park:         [['leisure', '^(park|garden|common)$']],
};

// Categories that have both an icon and real OSM data -> shown as filter chips.
export const DEFAULT_CATEGORIES = [
  'university', 'school', 'library', 'wifi', 'cafe',
  'restaurant', 'park', 'green', 'market', 'convenience',
];

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

export function selectorsForCategory(cat: string | null): Array<[string, string]> {
  if (cat && cat !== 'all' && CAT_SELECTORS[cat]) return CAT_SELECTORS[cat];
  return DEFAULT_CATEGORIES.flatMap((c) => CAT_SELECTORS[c]);
}

export function buildQl(
  south: number, west: number, north: number, east: number,
  selectors: Array<[string, string]>
): string {
  // NODE-ONLY query. Adding `way`/`relation` blocks (esp. for `building`,
  // `natural`, `landuse` polygons) makes Overpass times out — those tags form
  // huge area geometries. Nodes are point amenities (schools, cafés, libraries…)
  // which is exactly what map markers need, and it is fast + reliable for a
  // single viewport.
  const blocks: string[] = ['[out:json][timeout:20];', '('];
  const seen = new Set<string>();
  for (const [k, regex] of selectors) {
    const key = `${k}|${regex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(`node["${k}"~"${regex}"](${south},${west},${north},${east});`);
  }
  blocks.push(');out center;');
  return blocks.join('\n');
}

export function deriveCategory(tags: Record<string, string | undefined>): string {
  const a = tags.amenity, b = tags.building, s = tags.shop;
  const l = tags.leisure, n = tags.natural, lu = tags.landuse;
  const w = tags.wifi, aw = tags['access:wifi'];
  if (a === 'university' || a === 'college' || a === 'polytechnic' || b === 'university' || b === 'college') return 'university';
  if (a === 'school' || b === 'school') return 'school';
  if (a === 'library') return 'library';
  if (a === 'wifi' || w === 'yes' || aw === 'yes') return 'wifi';
  if (a === 'cafe' || s === 'cafe' || s === 'coffee') return 'cafe';
  if (a === 'restaurant' || a === 'fast_food') return 'restaurant';
  if (a === 'supermarket' || s === 'supermarket') return 'market';
  if (s === 'convenience') return 'convenience';
  if (l === 'park' || l === 'garden' || l === 'common') return 'park';
  if (n === 'wood' || n === 'grassland' || n === 'wetland' || lu === 'forest' || lu === 'meadow' || lu === 'grass') return 'green';
  return 'school';
}

export function addressOf(tags: Record<string, string | undefined>): string | undefined {
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:postcode']].filter(Boolean);
  return parts.length ? parts.join(' ') : tags['addr:city'];
}

export interface PoiAmenity {
  label: string;
  /** icon key, resolved to a lucide icon by the map popup */
  icon: string;
}

export interface PoiLocation {
  id: string;
  name: string;
  address?: string;
  description?: string;
  category: string;
  lat: number;
  lng: number;
  amenities?: PoiAmenity[];
}

export function elToLocation(el: any): PoiLocation | null {
  const tags = (el && el.tags) || {};
  const isNode = el.type === 'node';
  const lat = isNode ? el.lat : el.center?.lat;
  const lng = isNode ? el.lon : el.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const name = tags.name || tags['name:en'] || tags['name:vi'] || null;

  // Pull the POI's OWN facilities straight from OSM tags so the pin popup can
  // surface them (wifi, parking, toilets, wheelchair access, opening hours...).
  const amenities: PoiAmenity[] = [];
  if (tags.wifi === 'yes' || tags['access:wifi'] === 'yes') amenities.push({ label: 'Wifi', icon: 'wifi' });
  if (tags.parking) amenities.push({ label: 'Đậu xe', icon: 'parking' });
  if (tags.toilets === 'yes') amenities.push({ label: 'WC', icon: 'toilets' });
  if (tags.wheelchair === 'yes') amenities.push({ label: 'Tiếp cận', icon: 'wheelchair' });
  if (tags.opening_hours) amenities.push({ label: tags.opening_hours, icon: 'hours' });

  return {
    id: `osm:${el.type}:${el.id}`,
    name: name || 'Địa điểm',
    address: addressOf(tags) || undefined,
    description: typeof tags.description === 'string' ? tags.description : undefined,
    category: deriveCategory(tags),
    lat,
    lng,
    amenities: amenities.length ? amenities : undefined,
  };
}

/** In-memory cache for Overpass results (dev + prod-per-instance): avoids hitting
 * the public instance's fair-use limits on every viewport move / re-render. */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 80;
const cache = new Map<string, { data: any; ts: number }>();

export async function fetchFromOverpassCached(ql: string, cacheKey: string) {
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.data;
  const data = await fetchFromOverpass(ql);
  cache.set(cacheKey, { data, ts: now });
  if (cache.size > CACHE_MAX) {
    // drop the oldest entry
    const oldest = cache.entries().next().value;
    if (oldest) cache.delete(oldest[0]);
  }
  return data;
}

// Try each Overpass endpoint in turn; return the first successful parse.
export async function fetchFromOverpass(ql: string) {
  let lastErr: any;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 15000); // 15s per endpoint, then fall through
    try {
      const url = new URL(endpoint);
      url.searchParams.set('data', ql);
      // Overpass returns an HTML form unless a JSON Accept is negotiated.
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'EduMap-BFF/1.0 (openstreetmap)' },
        signal: ac.signal,
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        lastErr = new Error(`overpass ${res.status} from ${endpoint}`);
        continue;
      }
      const raw: any = await res.json();
      if (raw?.elements) return raw;
      lastErr = new Error(`overpass no elements from ${endpoint}`);
    } catch (e: any) {
      lastErr = e;
    } finally {
      clearTimeout(to);
    }
  }
  throw lastErr;
}
