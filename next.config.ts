import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native / heavy Node-only packages out of the bundler so they load
  // as normal CommonJS requires at runtime.
  serverExternalPackages: ["better-sqlite3", "@xenova/transformers"],
};

export default nextConfig;
