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
    value: 'interest-cohort=(), camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy-Report-Only',
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
  // Vercel's Supabase integration provides SUPABASE_URL and
  // SUPABASE_PUBLISHABLE_KEY. Map them into the browser-safe names at build
  // time so client auth and data queries use the same project.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'https://hnhhednibexcfwfizawy.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  async headers() {
    return [
    {
      source: '/:path*',
      headers: [...securityHeaders, { key: 'Vary', value: 'Accept-Encoding' }],
    },
    ];
  },
  images: {
    remotePatterns: [
      // Supabase Storage image URLs are public and must be allowed at build time.
      // Do not depend on NEXT_PUBLIC_SUPABASE_URL being present during config evaluation.
      {
        protocol: 'https',
        hostname: '**.supabase.co',
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
