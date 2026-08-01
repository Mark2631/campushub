import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Choose Institution | CampusTrader',
  description: 'Choose your CampusTrader institution to see relevant listings, requests, communities, and businesses.',
};

export default function InstitutionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
