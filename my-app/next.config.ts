import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Turbopack treats this `my-app` folder as the workspace root
    root: __dirname,
  },
};

export default nextConfig;
