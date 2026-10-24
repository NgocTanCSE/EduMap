import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * Library search — dual-source strategy.
 *
 *  PRIMARY   → Open Library Search API (https://openlibrary.org/search.json).
 *              Public, no API key, generous nonprofit quota. Returns books with
 *              rich cover images + direct read links. This is what the frontend
 *              `LibraryPage` / `libraryService` was built against, so on a healthy
 *              network the response shape below is unchanged.
 *
 *  FALLBACK  → Local SQLite `learning_materials` table via the NestJS backend
 *              (`/api/library/resources` = `LibraryController.findAll`). Used ONLY
 *              when Open Library is unreachable, rate-limited, or hangs — which is
 *              exactly what happens on HuggingFace Spaces where the shared,
 *              sandboxed egress to `openlibrary.org` is unreliable (frequent 503
 *              "Service Unavailable" or connection-level hangs).
 *
 * Why the fallback exists (root cause it fixes):
 *  - OpenLibrary is a free nonprofit API with NO uptime SLA. From HF Spaces it
 *    intermittently returns `503` or simply never completes the TCP/TLS handshake,
 *    so a raw `fetch()` to `openlibrary.org/search.json` can hang INDEFINITELY.
 *  - The previous version of this handler called OpenLibrary with NO timeout, so
 *    a hung OpenLibrary response propagated straight into the request, hitting the
 *    frontend BFF's 15s AbortController → "Request timeout" toast → the library
 *    grid rendered ZERO books.
 *
 * Contract returned to the frontend (unchanged from the original handler):
 *   { data: { items: [...], meta: { currentPage, totalPages, total } } }
 * Each item: { id, type, title, author, cover_image_url, description,
 *              category, view_count, file_url, source }
 *
 * NOTE: the backend `/api/library/search` endpoint is intentionally NOT used as
 * the fallback, because it uses `ILIKE` in its query builder, which is a
 * PostgreSQL-only operator and throws a SQL syntax error on SQLite (the DB the
 * HF Spaces container runs). `/api/library/resources` (findAll) avoids ILIKE and
 * works reliably, so any keyword/category filtering in fallback mode is done
 * client-side here.
 */
const OL_BASE = 'https://openlibrary.org/search.json';
const LIMIT_MAX = 100; // Open Library hard cap
const OL_TIMEOUT_MS = 8000; // fail fast so we can serve the SQLite fallback < frontend's 15s abort
const FALLBACK_FETCH_TOTAL = 500; // pull the whole local catalog once, filter in-memory

/** OpenLibrary doc → frontend item shape (kept identical to the original mapping). */
function mapOpenLibrary(doc: any, subject: string): any {
  const coverId: number | undefined = doc.cover_i;
  const cover_url = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
    : '';
  const key: string = doc.key || '';
  return {
    id: key ? `ol:${key}` : `ol:work:${doc.title || Math.random().toString(36).slice(2)}`,
    type: doc.content_format?.includes('video') ? 'video' : 'book',
    title: doc.title || 'Untitled',
    author: (doc.author_name || []).join(', ') || 'Unknown Author',
    cover_image_url: cover_url,
    description: '', // not in search result; detail endpoint could enrich
    category: (doc.subject || [])[0] || subject || 'General',
    view_count: doc.readinglog_count || 0,
    file_url: key ? `https://openlibrary.org${key}` : '',
    source: 'open-library',
  };
}

/** Local SQLite learning_material row → same frontend item shape. */
function mapSqlite(doc: any): any {
  const description: string = doc.description || '';
  // The seeded local catalog stores the author inside the description as
  // "Author: <name>", e.g. "Author: Ally M." — extract it so the card renders a
  // real author instead of falling back to the "EduMap Library" placeholder.
  const authorMatch = description.match(/^Author:\s*(.+)$/i);
  return {
    id: doc.id ?? `local:${doc.title || Math.random().toString(36).slice(2)}`,
    type: doc.type || 'book',
    title: doc.title || 'Untitled',
    author: authorMatch ? authorMatch[1] : undefined,
    cover_image_url: doc.thumbnail_url || '',
    description,
    category: doc.subject || 'General',
    view_count: doc.view_count ?? doc.download_count ?? 0,
    file_url: doc.file_url || '',
    source: 'local-sqlite',
  };
}

/** Fetch OpenLibrary with a hard timeout. Never throws — returns a result envelope. */
async function fetchOpenLibrary(
  url: string,
  subject: string
): Promise<{ ok: true; items: any[]; total: number } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OL_TIMEOUT_MS);
  try {
    const res = await fetch(url, { next: { revalidate: 120 }, signal: controller.signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, reason: `OpenLibrary HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    const raw: any = await res.json().catch(() => null);
    if (!raw || !Array.isArray(raw.docs)) {
      return { ok: false, reason: 'OpenLibrary returned an unexpected payload' };
    }
    const docs: any[] = raw.docs;
    const items = docs.map((doc) => mapOpenLibrary(doc, subject));
    return { ok: true, items, total: raw.numFound || 0 };
  } catch (error: any) {
    const reason =
      error?.name === 'AbortError'
        ? `OpenLibrary timeout (>${OL_TIMEOUT_MS}ms)`
        : error?.message || String(error);
    return { ok: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch the local SQLite catalog from the NestJS backend (findAll — no ILIKE). */
async function fetchLocalCatalog(
  page: number,
  limit: number
): Promise<{ ok: true; items: any[]; meta: any } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const backendRes = await fetch(
      `${getBackendUrl()}/library/resources?page=1&limit=${FALLBACK_FETCH_TOTAL}`,
      { signal: controller.signal }
    );
    if (!backendRes.ok) {
      return { ok: false, reason: `backend /library/resources returned ${backendRes.status}` };
    }
    const json: any = await backendRes.json().catch(() => ({}));
    const payload = json?.data ?? json;
    const rawItems: any[] = Array.isArray(payload?.items) ? payload.items : [];
    return {
      ok: true,
      items: rawItems.map(mapSqlite),
      meta: payload?.meta || {},
    };
  } catch (error: any) {
    const reason =
      error?.name === 'AbortError'
        ? `backend catalog timeout (>6000ms)`
        : error?.message || String(error);
    return { ok: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const subject = sp.get('subject') || sp.get('category') || '';

  let page = parseInt(sp.get('page') || '1', 10);
  let limit = parseInt(sp.get('limit') || '12', 10);
  if (Number.isNaN(page) || page < 1) page = 1;
  if (Number.isNaN(limit) || limit < 1) limit = 12;
  if (limit > LIMIT_MAX) limit = LIMIT_MAX;

  // --- 1) PRIMARY: OpenLibrary (with a hard timeout) ---
  const olUrl = new URL(OL_BASE);
  olUrl.searchParams.set('limit', String(limit));
  olUrl.searchParams.set('page', String(page));
  if (q) {
    olUrl.searchParams.set('q', q);
  } else if (subject && subject !== 'Tất cả') {
    olUrl.searchParams.set('subject', subject);
  } else {
    olUrl.searchParams.set('q', 'education');
  }

  const ol = await fetchOpenLibrary(olUrl.toString(), subject);
  if (ol.ok) {
    return NextResponse.json({
      data: {
        items: ol.items,
        meta: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil((ol.total || 0) / limit)),
          total: ol.total || ol.items.length,
        },
      },
    });
  }

  // --- 2) FALLBACK: local SQLite catalog ---
  // OpenLibrary is the unreliable piece (frequent 503 / hangs on HF Spaces).
  // Log why we fell back so it's visible in the container logs.
  console.error(
    `[api/library/search] OpenLibrary unavailable (${ol.reason}); falling back to local SQLite library.`
  );

  const local = await fetchLocalCatalog(page, limit);
  if (!local.ok) {
    console.error('[api/library/search] SQLite fallback also failed:', local.reason);
    return NextResponse.json(
      { message: `Không tải được sách: ${ol.reason} và dữ liệu cục bộ cũng lỗi (${local.reason})` },
      { status: 502 }
    );
  }

  let items: any[] = local.items;

  // Honour the active category tab — but ONLY filter if it actually matches
  // local subjects (the frontend tabs are generic like "Programming", while the
  // local DB stores Vietnamese school subjects). This keeps the grid non-empty
  // when the tab doesn't map to any local subject.
  if (subject && subject !== 'Tất cả') {
    const subjectFiltered = items.filter(
      (it) => (it.category || '').toLowerCase() === subject.toLowerCase()
    );
    if (subjectFiltered.length > 0) items = subjectFiltered;
  }

  // Keyword search — applied client-side because the backend /library/search
  // endpoint uses ILIKE (PostgreSQL-only) and errors on SQLite.
  if (q) {
    const ql = q.toLowerCase();
    items = items.filter(
      (it) =>
        (it.title || '').toLowerCase().includes(ql) ||
        (it.description || '').toLowerCase().includes(ql)
    );
  }

  // In-memory pagination over the filtered/fetched set.
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return NextResponse.json({
    data: {
      items: paged,
      meta: { currentPage: page, totalPages, total },
    },
  });
}
