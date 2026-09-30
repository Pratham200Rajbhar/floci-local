import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pino", "pino-pretty"],
  allowedDevOrigins: ["192.168.31.187", "localhost", "127.0.0.1", "localhost.floci.io"],
};

export default nextConfig;
