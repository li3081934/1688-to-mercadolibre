import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    middlewareClientMaxBodySize: "100mb"
  }
};

export default nextConfig;