import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign In | CampusTrader',
  description: 'Create or access your CampusTrader account.',
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
