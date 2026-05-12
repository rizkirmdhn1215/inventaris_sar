import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow photo uploads in return flow (default is 1MB).
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
