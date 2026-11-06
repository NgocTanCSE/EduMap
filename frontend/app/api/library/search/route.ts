import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
const OL_BASE = 'https://openlibrary.org/search.json';
const LIMIT_MAX = 100;
const OL_TIMEOUT_MS = 8000;
const FALLBACK_FETCH_TOTAL = 500;
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
        description: '',
        category: (doc.subject || [])[0] || subject || 'General',
        view_count: doc.readinglog_count || 0,
        file_url: key ? `https://openlibrary.org${key}` : '',
        source: 'open-library',
    };
}
function mapSqlite(doc: any): any {
    const description: string = doc.description || '';
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
async function fetchOpenLibrary(url: string, subject: string): Promise<{
    ok: true;
    items: any[];
    total: number;
} | {
    ok: false;
    reason: string;
}> {
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
    }
    catch (error: any) {
        const reason = error?.name === 'AbortError'
            ? `OpenLibrary timeout (>${OL_TIMEOUT_MS}ms)`
            : error?.message || String(error);
        return { ok: false, reason };
    }
    finally {
        clearTimeout(timeout);
    }
}
async function fetchLocalCatalog(page: number, limit: number): Promise<{
    ok: true;
    items: any[];
    meta: any;
} | {
    ok: false;
    reason: string;
}> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
        const backendRes = await fetch(`${getBackendUrl()}/library/resources?page=1&limit=${FALLBACK_FETCH_TOTAL}`, { signal: controller.signal });
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
    }
    catch (error: any) {
        const reason = error?.name === 'AbortError'
            ? `backend catalog timeout (>6000ms)`
            : error?.message || String(error);
        return { ok: false, reason };
    }
    finally {
        clearTimeout(timeout);
    }
}
export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim();
    const subject = sp.get('subject') || sp.get('category') || '';
    let page = parseInt(sp.get('page') || '1', 10);
    let limit = parseInt(sp.get('limit') || '12', 10);
    if (Number.isNaN(page) || page < 1)
        page = 1;
    if (Number.isNaN(limit) || limit < 1)
        limit = 12;
    if (limit > LIMIT_MAX)
        limit = LIMIT_MAX;
    const olUrl = new URL(OL_BASE);
    olUrl.searchParams.set('limit', String(limit));
    olUrl.searchParams.set('page', String(page));
    if (q) {
        olUrl.searchParams.set('q', q);
    }
    else if (subject && subject !== 'Tất cả') {
        olUrl.searchParams.set('subject', subject);
    }
    else {
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
    console.error(`[api/library/search] OpenLibrary unavailable (${ol.reason}); falling back to local SQLite library.`);
    const local = await fetchLocalCatalog(page, limit);
    if (!local.ok) {
        console.error('[api/library/search] SQLite fallback also failed:', local.reason);
        return NextResponse.json({ message: `Không tải được sách: ${ol.reason} và dữ liệu cục bộ cũng lỗi (${local.reason})` }, { status: 502 });
    }
    let items: any[] = local.items;
    if (subject && subject !== 'Tất cả') {
        const subjectFiltered = items.filter((it) => (it.category || '').toLowerCase() === subject.toLowerCase());
        if (subjectFiltered.length > 0)
            items = subjectFiltered;
    }
    if (q) {
        const ql = q.toLowerCase();
        items = items.filter((it) => (it.title || '').toLowerCase().includes(ql) ||
            (it.description || '').toLowerCase().includes(ql));
    }
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
