import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'List an Item | CampusTrader',
  description: 'List an item, offer a service, or post a request for MUST students on CampusTrader.',
};

export default function SellLayout({ children }: { children: ReactNode }) {
  return children;
}
