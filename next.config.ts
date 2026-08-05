import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const securityHeaders = [
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; frame-src https://*.googlesyndication.com https://googleads.g.doubleclick.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
