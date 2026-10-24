/**
 * Local, dependency-free illustrations shipped in `public/illustrations`.
 *
 * Why local SVGs instead of stock photo URLs:
 * - no third-party request at render time (works offline / behind HF proxy)
 * - no broken images when an external CDN changes a photo id
 * - consistent "Desert Dusk" palette with the rest of the UI
 *
 * The mapping is intentionally deterministic: the same event / opportunity
 * always gets the same artwork, so cards do not flicker between renders.
 */

export const ILLUSTRATIONS = {
  events: '/illustrations/events.svg',
  opportunities: '/illustrations/opportunities.svg',
  learning: '/illustrations/learning.svg',
  community: '/illustrations/community.svg',
  internships: '/illustrations/internships.svg',
  stem: '/illustrations/stem.svg',
  marketplace: '/illustrations/marketplace.svg',
  surveys: '/illustrations/surveys.svg',
  career: '/illustrations/career.svg',
} as const;

function normalize(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/** Event card / detail hero artwork, based on type + title. */
export function eventIllustration(type?: string, title?: string): string {
  const text = normalize(`${type || ''} ${title || ''}`);
  if (hasAny(text, ['stem', 'robot', 'khoa hoc', 'science'])) return ILLUSTRATIONS.stem;
  if (hasAny(text, ['hackathon', 'contest', 'competition', 'cuoc thi', 'eureka', 'p2a', 'challenge'])) {
    return ILLUSTRATIONS.opportunities;
  }
  if (hasAny(text, ['camp', 'mua he', 'tinh nguyen', 'cong dong', 'community'])) {
    return ILLUSTRATIONS.community;
  }
  if (hasAny(text, ['huong nghiep', 'tuyen sinh', 'career', 'job fair'])) {
    return ILLUSTRATIONS.career;
  }
  return ILLUSTRATIONS.events;
}

/** Opportunity card / detail hero artwork, based on the Vietnamese category. */
export function opportunityIllustration(category?: string, title?: string): string {
  const text = normalize(`${category || ''} ${title || ''}`);
  if (hasAny(text, ['cuoc thi', 'hackathon', 'olympic', 'contest', 'challenge', 'thi '])) {
    return ILLUSTRATIONS.opportunities;
  }
  if (hasAny(text, ['khoa hoc', 'course', 'dao tao', 'hoc online', 'lap trinh', 'ai', 'python'])) {
    return ILLUSTRATIONS.learning;
  }
  if (hasAny(text, ['hoat dong', 'tinh nguyen', 'cong dong', 'hien mau', 'mua he xanh'])) {
    return ILLUSTRATIONS.community;
  }
  return ILLUSTRATIONS.opportunities;
}

/** Internship card / detail logo fallback. */
export function internshipIllustration(field?: string, title?: string): string {
  const text = normalize(`${field || ''} ${title || ''}`);
  if (hasAny(text, ['data', 'ai', 'machine learning', 'phan tich', 'business intelligence'])) {
    return ILLUSTRATIONS.career;
  }
  if (hasAny(text, ['thiet ke', 'design', 'marketing', 'content', 'truyen thong'])) {
    return ILLUSTRATIONS.learning;
  }
  return ILLUSTRATIONS.internships;
}

/** STEM lab card artwork. */
export function stemIllustration(name?: string): string {
  const text = normalize(name);
  if (hasAny(text, ['robot', 'iot', 'dien tu', 'tu dong'])) return ILLUSTRATIONS.opportunities;
  return ILLUSTRATIONS.stem;
}

/** Marketplace item artwork. */
export function marketplaceIllustration(category?: string): string {
  const text = normalize(category);
  if (hasAny(text, ['book', 'sach', 'tai lieu'])) return ILLUSTRATIONS.learning;
  return ILLUSTRATIONS.marketplace;
}

/** Job board artwork. */
export function jobIllustration(title?: string, company?: string): string {
  const text = normalize(`${title || ''} ${company || ''}`);
  if (hasAny(text, ['data', 'ai', 'machine learning', 'phan tich'])) return ILLUSTRATIONS.career;
  if (hasAny(text, ['design', 'thiet ke', 'marketing', 'content'])) return ILLUSTRATIONS.learning;
  return ILLUSTRATIONS.career;
}

/* ---------------------------------------------------------------------------
 * Default avatar — a warm Desert Dusk gradient with the user's initials.
 *
 * The old fallback was one static person icon for every account, which made
 * lists (leaderboard, friends, comments, mentors) look repetitive. This
 * generator keeps the same local/deterministic guarantees — no remote CDN,
 * no request at render time — while giving each person a recognisable card:
 * a seeded two-colour background, soft light shapes and their initials.
 * ------------------------------------------------------------------------- */

const AVATAR_PALETTE: Array<[string, string]> = [
  ['#E07A5F', '#A84B34'], // terracotta
  ['#81B29A', '#467A64'], // sage
  ['#C4A484', '#8A6A4A'], // clay
  ['#6B5D7B', '#3E3450'], // plum
  ['#5A7D7C', '#34504F'], // teal
  ['#D08C60', '#8F5535'], // amber
  ['#7A9E9F', '#4B6E6F'], // slate teal
  ['#B5838D', '#7A4E58'], // rose
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Deterministic two-colour gradient for avatars and content placeholders. */
export function placeholderColors(seed?: string): [string, string] {
  return AVATAR_PALETTE[hashString(seed?.trim() || 'EduMap') % AVATAR_PALETTE.length];
}

/** Letters/numbers in a word, without requiring the ES2015 `u` regex flag. */
function wordCharacters(word: string): string[] {
  return Array.from(word).filter(
    (char) => /[0-9]/.test(char) || char.toLowerCase() !== char.toUpperCase(),
  );
}

/** First letters of the first + last word, or two letters for a single name. */
export function avatarInitials(name?: string): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'EM';

  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    const chars = wordCharacters(words[0]);
    return (chars.slice(0, 2).join('') || 'EM').toUpperCase();
  }

  const first = wordCharacters(words[0])[0] || '';
  const last = wordCharacters(words[words.length - 1])[0] || '';
  const result = `${first}${last}`;
  return (result || 'EM').toUpperCase();
}

/**
 * Data-URI SVG used whenever a user has no avatar (or the uploaded URL fails).
 * Deterministic for a given name, so the same person keeps the same colours.
 */
export function avatarFallback(name?: string): string {
  const label = avatarInitials(name);
  const [from, to] = placeholderColors(name);
  const fontSize = label.length > 1 ? 168 : 204;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="${escapeXml(name || 'Ảnh đại diện')}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="86" cy="92" r="176" fill="#ffffff" opacity="0.08"/>
  <circle cx="438" cy="438" r="216" fill="#000000" opacity="0.10"/>
  <path d="M0 512 L512 0 L512 136 L136 512 Z" fill="#ffffff" opacity="0.045"/>
  <circle cx="256" cy="256" r="198" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
  <text x="256" y="258" text-anchor="middle" dominant-baseline="central" font-family="Inter, 'Segoe UI', system-ui, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="2" fill="#FFF7ED" opacity="0.96">${escapeXml(label)}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Shared `<img onError>` handler factory: when an image URL exists but fails
 * to load (upload lost after an HF rebuild, expired external CDN link, . . .),
 * swap it for a default image instead of showing a broken-image icon.
 * The data-guard prevents the fallback itself from re-triggering the handler.
 */
export function onImageError(fallbackSrc: string) {
  return (event: { currentTarget: HTMLImageElement }): void => {
    const img = event.currentTarget;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = 'true';
    img.src = fallbackSrc;
  };
}
