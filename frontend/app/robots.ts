import { MetadataRoute } from 'next';
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/moderator/'],
    },
    sitemap: 'https://edumap.vn/sitemap.xml',
  }
}
