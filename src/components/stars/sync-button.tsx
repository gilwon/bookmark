// GitHub Star 동기화 버튼 — 변경 요약 메시지 표시
"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type StarSyncSummary = {
  count: number;
  removed: number;
  added: number;
  updated: number;
  starsChanged: number;
  lastSynced: string;
};

type Props = {
  lastSynced?: string | null;
  hasGithub?: boolean;
  autoSync?: boolean;
  onSynced?: (info: StarSyncSummary) => void;
};

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return "방금 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  return `${Math.floor(diffSec / 86400)}일 전`;
}

/** Star 목록 동기화 + A: 신규/업데이트/제거 요약 */
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

  const handleSync = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setPhase("GitHub에서 Star 목록 가져오는 중…");
    try {
      const res = await fetch("/api/stars/sync", { method: "POST" });
      setPhase("변경 사항 반영 중…");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "동기화 실패"
        );
      }
      const count = Number((data as { count?: number }).count ?? 0);
      const removed = Number((data as { removed?: number }).removed ?? 0);
      const added = Number((data as { added?: number }).added ?? 0);
      const updated = Number((data as { updated?: number }).updated ?? 0);
      const starsChanged = Number(
        (data as { starsChanged?: number }).starsChanged ?? 0
      );
      const syncedAt =
        (data as { lastSynced?: string }).lastSynced ??
        new Date().toISOString();
      setLocalLast(syncedAt);

      const parts = [`총 ${count}개`];
      if (added > 0) parts.push(`신규 ${added}`);
      if (updated > 0) parts.push(`업데이트 ${updated}`);
      if (starsChanged > 0) parts.push(`⭐변동 ${starsChanged}`);
      if (removed > 0) parts.push(`제거 ${removed}`);
      if (added === 0 && updated === 0 && removed === 0) {
        setMessage(`${count}개 동기화 · 변경 없음`);
      } else {
        setMessage(parts.join(" · "));
      }

      onSynced?.({
        count,
        removed,
        added,
        updated,
        starsChanged,
        lastSynced: syncedAt,
      });
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
        <p className="max-w-xs text-right text-xs text-muted-foreground">
          {phase}
        </p>
      )}
      {!loading && message && (
        <p className="max-w-sm text-right text-xs font-medium text-indigo-600 dark:text-indigo-300">
          {message}
        </p>
      )}
      {!loading && !message && localLast && (
        <p className="max-w-xs text-right text-xs text-muted-foreground">
          마지막 동기화 · {formatRelative(localLast)}
        </p>
      )}
      {!hasGithub && (
        <p className="max-w-xs text-right text-xs text-amber-600 dark:text-amber-400">
          GitHub 로그인 후 동기화할 수 있습니다.
        </p>
      )}
    </div>
  );
}
