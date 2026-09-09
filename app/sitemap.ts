import type { MetadataRoute } from 'next';

const siteUrl = 'https://campus-trader.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/signin`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/community`, changeFrequency: 'daily', priority: 0.7 },
  ];
}
