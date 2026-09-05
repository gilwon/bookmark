// 루트 세그먼트 런타임 에러 경계
"use client";

import { useEffect } from "react";
import { RecoveryPanel } from "@/components/recovery-panel";

export default function Error({
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
    <RecoveryPanel
      title="화면을 불러오지 못했습니다"
      description="잠시 후 다시 시도해 주세요. 계속되면 홈에서 다른 메뉴로 이동할 수 있습니다."
      digest={error.digest}
      onRetry={unstable_retry}
    />
  );
}
