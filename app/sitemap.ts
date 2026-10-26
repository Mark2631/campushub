import type { MetadataRoute } from 'next';

const siteUrl = 'https://campus-trader.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  // Keep only canonical, public pages intended for search discovery.
  // Omit lastModified rather than claiming every URL changed on every build.
  return [
    { url: `${siteUrl}/` },
    { url: `${siteUrl}/community` },
    { url: `${siteUrl}/help` },
    { url: `${siteUrl}/sell` },
  ];
}
