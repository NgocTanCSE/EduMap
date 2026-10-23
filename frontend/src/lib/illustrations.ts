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

/** Default avatar image (deterministic colored initials). */
export function avatarFallback(name?: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random`;
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
