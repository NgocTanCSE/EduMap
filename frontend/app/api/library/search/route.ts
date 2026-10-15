import { NextRequest, NextResponse } from 'next/server';

/**
 * Library search — backed by the Open Library Search API
 * (https://openlibrary.org/dev/docs/api/books) — public, no API key, generous
 * nonprofit quota, returns books JSON directly so the feature works even while
 * the local DB / edumap_backend_dev is down.
 *
 * Open Library returns its own shape; we map it to the contract the frontend
 * `libraryService` / `LibraryPage` already expect (NO frontend change needed):
 *   { data: { items: [...], meta: { currentPage, totalPages, total } } }
 * Each item: { id, type, title, author, cover_image_url, description,
 *              category, view_count, file_url, source }
 *
 * Env (all optional):
 *   LIB_BOOKS_API = 'openlibrary' | 'google'   (future: swap provider)
 */
const OL_BASE = 'https://openlibrary.org/search.json';
const LIMIT_MAX = 100; // Open Library hard cap

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const subject = sp.get('subject') || sp.get('category') || '';

  let page = parseInt(sp.get('page') || '1', 10);
  let limit = parseInt(sp.get('limit') || '12', 10);
  if (Number.isNaN(page) || page < 1) page = 1;
  if (Number.isNaN(limit) || limit < 1) limit = 12;
  if (limit > LIMIT_MAX) limit = LIMIT_MAX;

  const url = new URL(OL_BASE);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('page', String(page));

  // Prefer an explicit keyword search; else filter by the active category tab;
  // else fall back to a broad default so the page is never empty.
  if (q) {
    url.searchParams.set('q', q);
  } else if (subject && subject !== 'Tất cả') {
    url.searchParams.set('subject', subject);
  } else {
    url.searchParams.set('q', 'education');
  }

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 120 } });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json(
        { message: `Open Library trả về lỗi ${res.status}: ${txt.slice(0, 200)}` },
        { status: res.status }
      );
    }
    const raw: any = await res.json();

    const docs: any[] = raw.docs || [];
    const items = docs.map((doc) => {
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
    });

    const total = raw.numFound || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      data: {
        items,
        meta: {
          currentPage: page,
          totalPages,
          total,
        },
      },
    });
  } catch (error: any) {
    console.error('[api/library/search] BFF error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới thư viện' },
      { status: 500 }
    );
  }
}
