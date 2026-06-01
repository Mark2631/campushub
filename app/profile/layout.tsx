import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Your Profile | CampusTrader',
  description: 'Manage your CampusTrader identity, verification status, listings, and account settings.',
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
