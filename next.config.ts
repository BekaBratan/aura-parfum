import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.124.73.126"],
  images: {
    // Disable Vercel image optimization globally — we serve product images
    // straight from Supabase Storage (Free plan: raw object URLs; Pro: helper
    // can rewrite to /render/image transforms via NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS).
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
