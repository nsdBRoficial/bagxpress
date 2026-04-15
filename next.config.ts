import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Avatares dos creators da Bags API
      { protocol: "https", hostname: "**.bags.fm" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      // unavatar.io — proxy de avatares para handle lookup
      { protocol: "https", hostname: "unavatar.io" },
      // CDN genérico para pfp URLs variadas
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
