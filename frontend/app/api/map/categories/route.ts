import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { DEFAULT_CATEGORIES } from '@/src/lib/map-constants';

/**
 * GET /api/map/categories — distinct POI categories for the filter chips.
 *
 * PRIMARY: a static, locale-safe list that matches the icons used by
 * `MapComponent.getIconForCategory` (wifi, school, library, cafe, park...).
 * Keeps the filter row usable even while the backend/DB is down.
 *
 * FALLBACK still proxies to the NestJS backend if reachable, so a richer
 * category set can extend the chips when the DB is back.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const response = await fetch(`${getBackendUrl()}/map/categories`, { headers });
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
    // backend down / error -> fall through to static defaults
  } catch (error) {
    // network error -> fall through to static defaults
  }

  return NextResponse.json({ data: DEFAULT_CATEGORIES });
}

export const dynamic = 'force-dynamic';
