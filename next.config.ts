import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A package-lock.json above the repo makes Turbopack guess the wrong workspace
  // root, so pin it to this project.
  turbopack: { root: __dirname },
};

export default nextConfig;
