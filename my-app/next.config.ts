import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Turbopack treats this `my-app` folder as the workspace root
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hubinterior-quote-2026.s3.ap-south-2.amazonaws.com',
        pathname: '/logo/**',
      },
    ],
  },
};

export default nextConfig;
