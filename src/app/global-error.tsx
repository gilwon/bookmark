// 루트 레이아웃까지 깨졌을 때. html·body를 직접 연다.
"use client";

import { useEffect } from "react";
import { RecoveryPanel } from "@/components/recovery-panel";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <RecoveryPanel
          title="앱을 불러오지 못했습니다"
          description="페이지를 새로고침하거나 잠시 후 다시 시도해 주세요."
          digest={error.digest}
          onRetry={unstable_retry}
        />
      </body>
    </html>
  );
}
