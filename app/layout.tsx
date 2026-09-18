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
  title: 'CampusTrader | MUST Campus Marketplace',
  description: 'Buy, sell, request services, follow official updates, and message students around Meru University safely.',
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
    title: 'CampusTrader | MUST Campus Marketplace',
    description: 'Buy, sell, request services, follow official updates, and message students around Meru University safely.',
    url: 'https://campus-trader.vercel.app',
    siteName: 'CampusTrader',
    images: [
      {
        url: '/og-campus-trader-v2.png',
        width: 1200,
        height: 630,
        alt: 'CampusTrader MUST marketplace preview',
      },
    ],
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CampusTrader | MUST Campus Marketplace',
    description: 'Buy, sell, request services, follow official updates, and message students around Meru University safely.',
    images: ['/og-campus-trader-v2.png'],
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
