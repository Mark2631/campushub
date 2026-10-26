import type { MetadataRoute } from 'next';
import { supabase } from '../lib/supabase';

const siteUrl = 'https://campus-trader.vercel.app';

// Read active listings at request time. This route must not be frozen at build
// time, when CI may only have placeholder Supabase credentials.
export const dynamic = 'force-dynamic';

const staticPages: MetadataRoute.Sitemap = [
  { url: `${siteUrl}/` },
  { url: `${siteUrl}/community` },
  { url: `${siteUrl}/help` },
  { url: `${siteUrl}/sell` },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, description, status, updated_at')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Could not load active listings for sitemap:', error.message);
      return staticPages;
    }

    const listingPages: MetadataRoute.Sitemap = (data ?? []).flatMap((listing) => {
      const title = typeof listing.title === 'string' ? listing.title.trim() : '';
      const description = typeof listing.description === 'string' ? listing.description.trim() : '';
      if (
        typeof listing.id !== 'string' ||
        title.length < 4 ||
        description.length < 40 ||
        listing.status !== 'active'
      ) {
        return [];
      }

      const entry: MetadataRoute.Sitemap[number] = {
        url: `${siteUrl}/listing/${listing.id}`,
      };
      const updatedAt = typeof listing.updated_at === 'string'
        ? Date.parse(listing.updated_at)
        : Number.NaN;
      if (Number.isFinite(updatedAt)) {
        entry.lastModified = new Date(updatedAt);
      }
      return [entry];
    });

    return [...staticPages, ...listingPages];
  } catch (error) {
    console.error('Could not build listing URLs for sitemap:', error);
    return staticPages;
  }
}
