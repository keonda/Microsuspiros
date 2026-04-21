import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "260mb",
    serverActions: {
      bodySizeLimit: "260mb"
    }
  }
};

export default nextConfig;
