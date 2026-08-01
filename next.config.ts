import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hnhhednibexcfwfizawy.supabase.co").hostname;
  } catch {
    return "hnhhednibexcfwfizawy.supabase.co";
  }
})();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.gstatic.com https://hnhhednibexcfwfizawy.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://hnhhednibexcfwfizawy.supabase.co wss://hnhhednibexcfwfizawy.supabase.co",
  "media-src 'self' blob: https://hnhhednibexcfwfizawy.supabase.co",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHostname },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.gstatic.com" },
      { protocol: "https", hostname: "campus-trader.vercel.app" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
