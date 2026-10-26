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
  title: 'CampusTrader | Student Marketplace in Kenya',
  description: 'Buy and sell electronics, books, fashion, furniture, food and services on campus in Kenya. Browse student listings or post a request on CampusTrader.',
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
    title: 'CampusTrader | Student Marketplace in Kenya',
    description: 'Buy and sell electronics, books, fashion, furniture, food and services on campus in Kenya. Browse student listings or post a request on CampusTrader.',
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
    card: 'summary_large_image',
    title: 'CampusTrader | Student Marketplace in Kenya',
    description: 'Buy and sell electronics, books, fashion, furniture, food and services on campus in Kenya. Browse student listings or post a request on CampusTrader.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: [{ url: '/pwa-icon/192', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/pwa-icon/180', sizes: '180x180', type: 'image/png' }],
    // Google Search's favicon crawler supports raster formats such as PNG; use the same
    // stable, generated artwork as the PWA instead of pointing shortcut-icon at SVG.
    shortcut: ['/pwa-icon/192'],
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
                  url: "https://campus-trader.vercel.app/pwa-icon/512",
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
