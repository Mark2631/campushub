import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Campus Communities | CampusTrader',
  description: 'Discover campus communities for marketplace updates, student deals, services, lost and found notices, and announcements across universities and colleges in Kenya.',
};

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return children;
}
