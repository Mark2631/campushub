import type { MetadataRoute } from 'next';

const siteUrl = 'https://campus-trader.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Only include public pages intended to appear in search. Account, admin,
  // messaging, and transaction pages are deliberately excluded.
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/community`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/help`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/sell`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
  ];
}
