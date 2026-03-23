import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: { ignoreDuringBuilds: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  // Additional options that can help with hydration issues
  experimental: {
    optimizePackageImports: ["@/components"],
  },
  // Ensure static files are properly served
  async rewrites() {
    return [
      {
        source: "/:path*.md",
        destination: "/api/markdown/:path*",
      },
    ];
  },
};

export default nextConfig;
