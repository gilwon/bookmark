"use client";
// 심팀장 자료실 목록을 홈과 맞추는 버튼을 보여 준다.
import { useState } from "react";
import { syncShimGuidesAction } from "@/app/(app)/shim-guides/actions";
import { Button } from "@/components/ui/button";

export function SyncButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSync() {
    setPending(true);
    try {
      setResult(await syncShimGuidesAction());
    } catch {
      setResult({ ok: false, message: "동기화에 실패했습니다." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="h-11 min-h-11"
        onClick={onSync}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "동기화 중" : "목록 동기화"}
      </Button>
      {result?.ok ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {result.message}
        </p>
      ) : null}
      {result && !result.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
