import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sell on CampusTrader | Student Marketplace Kenya',
  description: 'List products, offer services, and reach buyers in your campus community. CampusTrader connects students and businesses across universities and colleges in Kenya.',
  alternates: {
    canonical: 'https://campus-trader.vercel.app/sell',
  },
  openGraph: {
    title: 'Sell on CampusTrader | Student Marketplace Kenya',
    description: 'List products and services for students and campus communities across Kenya.',
    url: 'https://campus-trader.vercel.app/sell',
    siteName: 'CampusTrader',
    type: 'website',
  },
};

export default function SellLayout({ children }: { children: ReactNode }) {
  return children;
}
