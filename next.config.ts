import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    // Conservative CSP that allows Supabase, Google OAuth, and common asset hosts.
    value:
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' https: wss:; " +
      "img-src 'self' data: blob: https:; " +
      "style-src 'self' 'unsafe-inline' https:; " +
      "font-src 'self' https:; " +
      "frame-src 'self' https://accounts.google.com https://*.supabase.co; " +
      "form-action 'self' https://*.supabase.co https://accounts.google.com; " +
      "base-uri 'self';",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : 'supabase.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
