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
export function eventIllustration(type?: string, title?: string): string {
    const text = normalize(`${type || ''} ${title || ''}`);
    if (hasAny(text, ['stem', 'robot', 'khoa hoc', 'science']))
        return ILLUSTRATIONS.stem;
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
export function stemIllustration(name?: string): string {
    const text = normalize(name);
    if (hasAny(text, ['robot', 'iot', 'dien tu', 'tu dong']))
        return ILLUSTRATIONS.opportunities;
    return ILLUSTRATIONS.stem;
}
export function marketplaceIllustration(category?: string): string {
    const text = normalize(category);
    if (hasAny(text, ['book', 'sach', 'tai lieu']))
        return ILLUSTRATIONS.learning;
    return ILLUSTRATIONS.marketplace;
}
export function jobIllustration(title?: string, company?: string): string {
    const text = normalize(`${title || ''} ${company || ''}`);
    if (hasAny(text, ['data', 'ai', 'machine learning', 'phan tich']))
        return ILLUSTRATIONS.career;
    if (hasAny(text, ['design', 'thiet ke', 'marketing', 'content']))
        return ILLUSTRATIONS.learning;
    return ILLUSTRATIONS.career;
}
const AVATAR_PALETTE: Array<[
    string,
    string
]> = [
    ['#E07A5F', '#A84B34'],
    ['#81B29A', '#467A64'],
    ['#C4A484', '#8A6A4A'],
    ['#6B5D7B', '#3E3450'],
    ['#5A7D7C', '#34504F'],
    ['#D08C60', '#8F5535'],
    ['#7A9E9F', '#4B6E6F'],
    ['#B5838D', '#7A4E58'],
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
export function placeholderColors(seed?: string): [
    string,
    string
] {
    return AVATAR_PALETTE[hashString(seed?.trim() || 'EduMap') % AVATAR_PALETTE.length];
}
function wordCharacters(word: string): string[] {
    return Array.from(word).filter((char) => /[0-9]/.test(char) || char.toLowerCase() !== char.toUpperCase());
}
export function avatarInitials(name?: string): string {
    const cleaned = (name || '').trim();
    if (!cleaned)
        return 'EM';
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
export function avatarFallback(name?: string): string {
    const label = avatarInitials(name);
    const [from, to] = placeholderColors(name);
    const fontSize = label.length > 1 ? 168 : 204;
    const svg = `<svg xmlns="http:
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
export function onImageError(fallbackSrc: string) {
    return (event: {
        currentTarget: HTMLImageElement;
    }): void => {
        const img = event.currentTarget;
        if (img.dataset.fallbackApplied)
            return;
        img.dataset.fallbackApplied = 'true';
        img.src = fallbackSrc;
    };
}
