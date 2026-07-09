// GitHub Star 동기화 버튼 — 진행 상태·마지막 동기화 시각 표시
"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  /** ISO 문자열 또는 null */
  lastSynced?: string | null;
  hasGithub?: boolean;
  /** true면 마운트 시 자동 동기화 1회 */
  autoSync?: boolean;
  onSynced?: (info: {
    count: number;
    removed: number;
    lastSynced: string;
  }) => void;
};

/** 상대 시각 문자열 (간단 한국어). */
function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return "방금 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  return `${Math.floor(diffSec / 86400)}일 전`;
}

/** Star 목록을 GitHub API에서 가져와 로컬 DB에 upsert한다. */
export function SyncButton({
  lastSynced,
  hasGithub = false,
  autoSync = false,
  onSynced,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localLast, setLocalLast] = useState(lastSynced ?? null);
  const autoTried = useRef(false);

  useEffect(() => {
    setLocalLast(lastSynced ?? null);
  }, [lastSynced]);

  /** POST /api/stars/sync */
  const handleSync = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setPhase("GitHub에서 Star 목록 가져오는 중…");
    try {
      const res = await fetch("/api/stars/sync", { method: "POST" });
      setPhase("로컬 DB에 반영하는 중…");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "동기화 실패");
      }
      const count = data.count ?? 0;
      const removed = data.removed ?? 0;
      const syncedAt = data.lastSynced ?? new Date().toISOString();
      setLocalLast(syncedAt);
      setMessage(
        removed > 0
          ? `${count}개 동기화 · unstar ${removed}개 정리`
          : `${count}개 레포를 동기화했습니다.`
      );
      onSynced?.({ count, removed, lastSynced: syncedAt });
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setPhase(null);
      setLoading(false);
    }
  }, [onSynced, router]);

  useEffect(() => {
    if (!autoSync || !hasGithub || autoTried.current) return;
    autoTried.current = true;
    void handleSync();
  }, [autoSync, hasGithub, handleSync]);

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <Button
        onClick={() => void handleSync()}
        disabled={loading || !hasGithub}
        variant="secondary"
        title={
          hasGithub
            ? "GitHub Star 목록을 다시 불러옵니다"
            : "GitHub로 로그인해야 동기화할 수 있습니다"
        }
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "동기화 중…" : "Star 동기화"}
      </Button>
      {loading && phase && (
        <p className="text-xs text-muted-foreground max-w-xs text-right">
          {phase}
        </p>
      )}
      {!loading && message && (
        <p className="text-xs text-muted-foreground max-w-xs text-right">
          {message}
        </p>
      )}
      {!loading && !message && localLast && (
        <p className="text-xs text-muted-foreground max-w-xs text-right">
          마지막 동기화 · {formatRelative(localLast)}
        </p>
      )}
      {!hasGithub && (
        <p className="text-xs text-amber-600 dark:text-amber-400 max-w-xs text-right">
          GitHub 로그인 후 동기화할 수 있습니다.
        </p>
      )}
    </div>
  );
}
