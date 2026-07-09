// GitHub Star 동기화 버튼
"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Star 목록을 GitHub API에서 가져와 로컬 DB에 upsert한다. */
export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /** POST /api/stars/sync */
  async function handleSync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stars/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "동기화 실패");
      }
      setMessage(`${data.count ?? 0}개 레포를 동기화했습니다.`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleSync} disabled={loading} variant="secondary">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "동기화 중…" : "Star 동기화"}
      </Button>
      {message && (
        <p className="text-xs text-muted-foreground max-w-xs text-right">{message}</p>
      )}
    </div>
  );
}
