import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fail the production build on type or lint errors instead of silently shipping.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    // server actions are stable in Next 15; keep body size sane for uploads handled elsewhere.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
