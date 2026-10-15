import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A package-lock.json above the repo makes Turbopack guess the wrong workspace
  // root, so pin it to this project.
  turbopack: { root: __dirname },
  // The dev badge sits bottom-left — on a phone it covers the crew app's SOS
  // button and the parent tab bar. Build errors still show as an overlay.
  devIndicators: false,
};

export default nextConfig;
