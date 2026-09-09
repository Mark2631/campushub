import type { MetadataRoute } from 'next';

const siteUrl = 'https://campus-trader.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/auth/callback'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
