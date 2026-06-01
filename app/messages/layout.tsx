import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Messages | CampusTrader',
  description: 'Message buyers and sellers safely on CampusTrader.',
};

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return children;
}
