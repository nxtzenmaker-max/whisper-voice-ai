import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },
  async rewrites() {
    return [
      {
        source: '/orb',
        destination: '/orb.html',
      },
      {
        source: '/awaaz',
        destination: '/orb.html',
      },
    ];
  },
};

export default nextConfig;
