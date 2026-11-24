import { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://edumap.vn';
    const pages: Array<{
        path: string;
        changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
        priority: number;
    }> = [
        { path: '/map', changeFrequency: 'daily', priority: 0.9 },
        { path: '/learn', changeFrequency: 'weekly', priority: 0.8 },
        { path: '/career', changeFrequency: 'weekly', priority: 0.8 },
        { path: '/community', changeFrequency: 'always', priority: 0.8 },
        { path: '/ai', changeFrequency: 'monthly', priority: 0.7 },
        { path: '/contribute', changeFrequency: 'weekly', priority: 0.7 },
        { path: '/library', changeFrequency: 'daily', priority: 0.8 },
        { path: '/scholarships', changeFrequency: 'daily', priority: 0.8 },
        { path: '/opportunities', changeFrequency: 'daily', priority: 0.9 },
        { path: '/mentor', changeFrequency: 'weekly', priority: 0.8 },
        { path: '/events', changeFrequency: 'weekly', priority: 0.7 },
        { path: '/hackathon', changeFrequency: 'weekly', priority: 0.7 },
        { path: '/impact', changeFrequency: 'weekly', priority: 0.7 },
    ];
    return pages.map((page) => ({
        url: `${baseUrl}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
    }));
}