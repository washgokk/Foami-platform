import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: false, // Enabled for testing push notifications
  register: true,
  sw: "sw.js",     // Output filename
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
