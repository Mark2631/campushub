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
  title: 'CampusTrader | Buy & Sell on Campus in Kenya',
  description: 'CampusTrader is a student marketplace in Kenya. Explore campus listings, buy and sell products, discover services and connect with students across colleges and universities.',
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
    canonical: 'https://campus-trader.vercel.app/',
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
    url: 'https://campus-trader.vercel.app/',
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
    icon: [{ url: '/campustrader-icon-192-v2.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/campustrader-icon-192-v2.png'],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": "https://campus-trader.vercel.app/#website",
                name: "CampusTrader",
                alternateName: ["Campus Trader", "campus-trader.vercel.app"],
                url: "https://campus-trader.vercel.app/",
                description: "A student marketplace in Kenya for buying and selling products, discovering services, and connecting with campus communities.",
                inLanguage: "en-KE",
                publisher: { "@id": "https://campus-trader.vercel.app/#organization" }
              },
              {
                "@type": "Organization",
                "@id": "https://campus-trader.vercel.app/#organization",
                name: "CampusTrader",
                alternateName: "Campus Trader",
                url: "https://campus-trader.vercel.app/",
                logo: {
                  "@type": "ImageObject",
                  url: "https://campus-trader.vercel.app/campustrader-icon-512-v2.png",
                  width: 512,
                  height: 512
                }
              }
            ]
          }) }}
        />
        <AppProvider>
          {children}
          <PWAInstallPrompt />
        </AppProvider>
      </body>
    </html>
  );
}
