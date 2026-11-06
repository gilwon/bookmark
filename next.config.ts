import type { NextConfig } from "next";

const shimGuideDataFiles = ["./src/data/shim-guides.json", "./src/data/shim-guide-bodies.json"];

const nextConfig: NextConfig = {
  // 인증 쿠키와 native sqlite 때문에 cacheComponents 전면 적용은 하지 않는다.
  // 목록 조회만 src/lib/list-cache.ts 에서 사용자 키로 짧게 캐시한다.
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
  // 동기화 함수가 본문 JSON을 빠뜨리면 저장된 글을 전부 새 글로 본다.
  outputFileTracingIncludes: {
    "/shim-guides": shimGuideDataFiles,
    "/shim-guides/*": shimGuideDataFiles,
  },
};

export default nextConfig;
