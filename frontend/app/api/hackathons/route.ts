import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * GET /api/hackathons — Hackathon list (app/hackathon/page.tsx).
 *
 * PRIMARY source: Devpost public API (https://devpost.com/api/hackathons) —
 *   NO key required, returns real public hackathons with live registration
 *   windows, prizes and links. The frontend (hackathonService.getHackathons)
 *   still calls this exact path with zero client changes.
 *
 * RESPONSE: bare JSON array `Hackathon[]` (the page does
 *   `setHackathons(await response.json())`), so we do NOT wrap in `{ data }`.
 *   Fields (see hackathon.service.ts `Hackathon` interface):
 *     id, title, description, start_date, end_date, status, created_at
 *
 * FALLBACK: if Devpost is unreachable, proxy to the NestJS backend GET
 *   /hackathons and normalise to a bare array; if the backend is also down,
 *   return HTTP 503 with a bare empty array so the page shows its empty state.
 */

const DEVPOST_ENDPOINT = 'https://devpost.com/api/hackathons';
const DEFAULT_LIMIT = 30;

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

// Parse Devpost's "submission_period_dates" (e.g. "Aug 31 - Oct 23, 2026")
// into start/end ISO strings. Devpost does not expose start_at/end_at directly.
function parsePeriod(period: string | undefined): { start: string | null; end: string | null } {
  if (!period) return { start: null, end: null };
  const parts = period.split(' - ');
  if (parts.length < 2) return { start: null, end: null };
  const endPart = parts[parts.length - 1].trim();         // "Oct 23, 2026"
  const startPart = parts.slice(0, -1).join(' - ').trim(); // "Aug 31"
  const year = endPart.match(/,\s*(\d{4})\s*$/);
  const y = year ? year[1] : new Date().getFullYear().toString();
  const start = new Date(`${startPart} ${y}`);
  const end = new Date(endPart);
  return {
    start: isNaN(start.getTime()) ? null : start.toISOString(),
    end: isNaN(end.getTime()) ? null : end.toISOString(),
  };
}

// Map Devpost open_state + dates -> 'ongoing' | 'upcoming' | 'completed'
function toStatus(h: any, start: string | null, end: string | null): string {
  const now = new Date();
  if (end && new Date(end) < now) return 'completed';
  if (h.open_state === 'open' && start && new Date(start) <= now) return 'ongoing';
  if (h.open_state === 'open') return 'upcoming';
  return 'completed';
}

function devpostToHackathon(h: any): any {
  const { start, end } = parsePeriod(h.submission_period_dates);
  const description =
    (h.description ? stripHtml(h.description) : '') ||
    h.time_left_to_submission ||
    h.submission_period_dates ||
    '';
  return {
    id: `devpost:${h.id}`,
    title: h.title || 'Cuộc thi',
    description,
    start_date: start,
    end_date: end || start,
    status: toStatus(h, start, end),
    created_at: h.created_at || new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const search = sp.get('search') || sp.get('q') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(sp.get('limit') || String(DEFAULT_LIMIT), 10)), 100);

  const url = new URL(DEVPOST_ENDPOINT);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(limit));
  if (search) url.searchParams.set('search', search);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'EduMap-BFF/1.0' },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.error('[api/hackathons] Devpost error:', res.status);
      throw new Error(`devpost ${res.status}`);
    }
    const raw: any = await res.json().catch(() => ({}));
    const items = Array.isArray(raw.hackathons) ? raw.hackathons : [];
    const hackathons = items.map(devpostToHackathon);
    // bare array — matches hackathonService.getHackathons -> response.json()
    return NextResponse.json(hackathons);
  } catch (e) {
    console.error('[api/hackathons] Devpost unavailable, falling back to backend:', e);
    // Fallback: proxy to NestJS backend, normalise to bare array.
    try {
      const burl = new URL(`${getBackendUrl()}/hackathons`);
      if (search) burl.searchParams.set('search', search);
      burl.searchParams.set('page', String(page));
      burl.searchParams.set('limit', String(limit));
      const authHeader = req.headers.get('Authorization');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authHeader) headers['Authorization'] = authHeader;
      const bres = await fetch(burl.toString(), { headers, next: { revalidate: 0 } });
      const bjson: any = await bres.json().catch(() => null);
      const arr = Array.isArray(bjson)
        ? bjson
        : bjson && Array.isArray(bjson.hackathons)
          ? bjson.hackathons
          : bjson && Array.isArray(bjson.data)
            ? bjson.data
            : [];
      return NextResponse.json(arr, { status: bres.status });
    } catch (e2) {
      console.error('[api/hackathons] backend fallback also failed:', e2);
      return NextResponse.json([], { status: 503 });
    }
  }
}

export const dynamic = 'force-dynamic';
