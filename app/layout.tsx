import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppProvider } from '../components/AppProvider';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import './globals.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://campus-trader.vercel.app'),
  title: 'CampusTrader | Campus Marketplace for Students',
  description: 'Buy, sell, request items, find services, and message students around campus safely.',
  keywords: [
    'CampusTrader',
    'Campus Trader',
    'campus marketplace',
    'student marketplace Kenya',
    'Meru campus marketplace',
    'MUST marketplace',
    'buy and sell campus',
    'student services',
    'student deals',
  ],
  alternates: {
    canonical: 'https://campus-trader.vercel.app',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'CampusTrader',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'CampusTrader | Campus Marketplace for Students',
    description: 'Buy, sell, request items, find services, and message students around campus safely.',
    url: 'https://campus-trader.vercel.app',
    siteName: 'CampusTrader',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'CampusTrader app icon',
      },
    ],
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CampusTrader | Campus Marketplace for Students',
    description: 'Buy, sell, request items, find services, and message students around campus safely.',
    images: ['/icons/icon-512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden flex flex-col">
        <AppProvider>
          {children}
          <PWAInstallPrompt />
        </AppProvider>
      </body>
    </html>
  );
}
