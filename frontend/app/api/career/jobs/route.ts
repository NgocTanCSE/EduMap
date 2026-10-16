import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * GET /api/career/jobs — Career / job-opportunity list.
 *
 * PRIMARY source: Adzuna (Vietnam jobs) — needs the free-tier
 *   ADZUNA_APP_ID / ADZUNA_APP_KEY (no credit card, 5k req/mo).
 *   Env lives server-side in frontend/.env.local so the key is never sent to
 *   the browser. The frontend (careerService.searchJobs) still calls this exact
 *   path, so NO client code changes are required.
 *
 * FALLBACK: if the Adzuna keys are absent (or an Adzuna request errors), proxy
 *   to the NestJS backend GET /career/jobs — so the page keeps working once the
 *   backend + DB are healthy, and behaves gracefully (503 empty) when both are
 *   down.
 *
 * Query params (from /app/career/jobs/page.tsx):
 *   keyword, location, job_type, page, limit
 * Response: { jobs: Job[], meta: { currentPage, totalPages, total, perPage } }
 */

const ADZUNA_ENDPOINT = 'https://api.adzuna.com/v1/api/jobs/vn/search';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
// Biên Hòa is the default search centre (matches the EduMap map defaultCenter).
const BIEN_HOA = { lat: 10.957, lng: 106.843, radiusKm: 50 };

const SKILL_KEYWORDS = [
  'react', 'vue', 'angular', 'node', 'python', 'java', 'go', 'rust',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'sql', 'postgresql', 'mongodb',
  'redis', 'graphql', 'typescript', 'javascript', 'php', 'laravel', 'django',
  'flutter', 'android', 'ios', 'swift', 'kotlin', 'figma', 'photoshop', 'seo',
  'agile', 'scrum', 'git', 'devops', 'tensorflow', 'pytorch', 'c++', 'c#',
];

// Adzuna contract_time / contract_type  ->  JobType enum (see backend job.entity.ts)
function toJobType(contractTime?: string, contractType?: string): string {
  const ct = (contractTime || '').toLowerCase();
  if (['full_time', 'part_time', 'internship', 'freelance', 'contract'].includes(ct)) return ct;
  const ctyp = (contractType || '').toLowerCase();
  if (ctyp === 'permanent' || !ctyp) return 'full_time';
  if (ctyp === 'temporary') return 'contract';
  return 'full_time';
}

function extractSkills(text: string): string[] {
  const lower = (text || '').toLowerCase();
  const found = new Set<string>();
  for (const kw of SKILL_KEYWORDS) {
    // escape regex metachars so "c++" / "c#" match literally as word tokens
    const re = new RegExp(`\\b${kw.replace(/[.+]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) found.add(kw);
  }
  return Array.from(found);
}

function fmtCurrency(n?: number): string {
  if (!n || n <= 0) return '';
  return new Intl.NumberFormat('vi-VN').format(n);
}

// Resolve a free-text location into lat/lng via Nominatim (best-effort).
// Falls back to Biên Hòa when no/blank location is supplied or geocoding fails.
async function resolveGeo(location: string): Promise<{ lat: number; lng: number; radiusKm: number }> {
  if (location) {
    try {
      const np = new URL('https://nominatim.openstreetmap.org/search');
      np.searchParams.set('q', location);
      np.searchParams.set('format', 'json');
      np.searchParams.set('limit', '1');
      np.searchParams.set('email', 'edumap@example.com');
      const nres = await fetch(np.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'EduMap-BFF/1.0' },
        next: { revalidate: 0 },
      });
      if (nres.ok) {
        const njson = await nres.json().catch(() => null);
        if (Array.isArray(njson) && njson[0]) {
          return { lat: parseFloat(njson[0].lat), lng: parseFloat(njson[0].lon), radiusKm: 50 };
        }
      }
    } catch {
      /* ignore — fall back to default below */
    }
  }
  return BIEN_HOA;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const keyword = sp.get('keyword') || '';
  const location = sp.get('location') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(sp.get('limit') || String(DEFAULT_LIMIT), 10)), MAX_LIMIT);

  const { lat, lng, radiusKm } = await resolveGeo(location);

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  // ---- PRIMARY: Adzuna (only when keys are configured) ----
  if (appId && appKey) {
    try {
      const url = new URL(`${ADZUNA_ENDPOINT}/${page}`);
      url.searchParams.set('app_id', appId);
      url.searchParams.set('app_key', appKey);
      url.searchParams.set('results_per_page', String(limit));
      if (keyword) url.searchParams.set('what', keyword);
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lng));
      url.searchParams.set('radius', String(radiusKm));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'EduMap-BFF/1.0' },
        next: { revalidate: 0 },
      });
      const raw: any = await res.json().catch(() => ({}));
      const results = Array.isArray(raw.results) ? raw.results : [];
      const jobs = results.map((r: any) => {
        const salaryParts: string[] = [];
        const smin = Number(r.salary_min);
        const smax = Number(r.salary_max);
        if (smin) salaryParts.push(fmtCurrency(smin));
        if (smax) salaryParts.push(fmtCurrency(smax));
        if (!smin && !smax) salaryParts.push('Thỏa thuận');
        return {
          id: `adzuna:${r.id}`,
          title: r.title || 'Không tiêu đề',
          company_name: (r.company && r.company.display_name) || 'Chưa rõ',
          location: (r.location && r.location.display_name) || '',
          job_type: toJobType(r.contract_time, r.contract_type),
          salary_range: salaryParts.join(' - '),
          required_skills: extractSkills(`${r.title || ''} ${r.description || ''}`),
          description: typeof r.description === 'string'
            ? r.description.replace(/<[^>]+>/g, ' ').slice(0, 500)
            : '',
          ...(r.latitude && r.longitude ? { latitude: Number(r.latitude), longitude: Number(r.longitude) } : {}),
        };
      });
      const total = Number(raw.count || jobs.length);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return NextResponse.json({
        jobs,
        meta: { currentPage: page, totalPages, total, perPage: limit },
      });
    } catch (e) {
      console.error('[api/career/jobs] Adzuna request failed, falling back to backend:', e);
      // fall through to backend fallback below
    }
  }

  // ---- FALLBACK: proxy to the NestJS backend ----
  try {
    const burl = new URL(`${getBackendUrl()}/career/jobs`);
    if (keyword) burl.searchParams.set('keyword', keyword);
    if (location) burl.searchParams.set('location', location);
    burl.searchParams.set('page', String(page));
    burl.searchParams.set('limit', String(limit));
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;
    const bres = await fetch(burl.toString(), { headers, next: { revalidate: 0 } });
    const bjson: any = await bres.json().catch(() => ({}));
    // Backend (with response interceptor) may wrap as { success, data:{jobs,meta} }
    // — normalise so the page's `data.jobs` always resolves.
    const data = (bjson && bjson.data) || bjson;
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const meta = data.meta || {
      currentPage: page,
      totalPages: 1,
      total: jobs.length,
      perPage: limit,
    };
    return NextResponse.json({ jobs, meta }, { status: bres.status });
  } catch (e2) {
    console.error('[api/career/jobs] backend fallback also failed:', e2);
    return NextResponse.json(
      {
        jobs: [],
        meta: { currentPage: page, totalPages: 1, total: 0, perPage: limit },
        message: appId
          ? 'Adzuna request failed and backend unavailable'
          : 'Adzuna credentials (ADZUNA_APP_ID/ADZUNA_APP_KEY) not configured and backend unavailable',
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const body = await req.json();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const response = await fetch(`${getBackendUrl()}/career/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ career' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
