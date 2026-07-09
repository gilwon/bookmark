import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3, open-graph-scraper는 네이티브/특수 의존성이라 서버 외부 패키지로 처리
  serverExternalPackages: [
    "better-sqlite3",
    "open-graph-scraper",
    "linkedom",
    "@mozilla/readability",
  ],
  images: {
    // OG 이미지는 외부 도메인에서 오므로 remote 허용
    remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "**" }],
  },
};

export default nextConfig;
