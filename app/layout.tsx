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
  title: 'CampusTrader | Inter-Institutional Marketplace',
  description: 'Discover products, services and businesses across universities, colleges and technical institutions. Buy, sell and connect with your campus community.',
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
    title: 'CampusTrader | Inter-Institutional Marketplace',
    description: 'Discover products, services and businesses across universities, colleges and technical institutions. Buy, sell and connect with your campus community.',
    url: 'https://campus-trader.vercel.app',
    siteName: 'CampusTrader',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'CampusTrader marketplace preview',
      },
    ],
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CampusTrader | Inter-Institutional Marketplace',
    description: 'Discover products, services and businesses across universities, colleges and technical institutions. Buy, sell and connect with your campus community.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/campustrader-icon-192-v2.png', sizes: '192x192', type: 'image/png' },
      { url: '/campustrader-icon-512-v2.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#020617',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
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
