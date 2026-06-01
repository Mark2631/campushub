import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'MUST Communities | CampusTrader',
  description: 'Follow official MUST communities, campus deals, lost and found updates, services, and useful links.',
};

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return children;
}
