// 스레드 카피 작성 폼 — 본문 중심
"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseCopyTags } from "@/lib/thread-copy";
import { cn } from "@/lib/utils";

const countFormatter = new Intl.NumberFormat("ko-KR");

/** 목록 상단에서 카피 본문을 붙여 넣는다. */
export function CopyComposer() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) {
      setError("본문을 입력하세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/copies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          title: title.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          tags: parseCopyTags(tags),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "저장에 실패했습니다."
        );
      }
      setBody("");
      setTitle("");
      setSourceUrl("");
      setTags("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4",
        error && "border-red-400/60"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="copy-body" className="text-xs text-muted-foreground">
            본문
          </label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {countFormatter.format(body.length)}자
          </span>
        </div>
        <Textarea
          id="copy-body"
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="스레드에 올릴 글을 붙여 넣으세요"
          className="min-h-32 whitespace-pre-wrap break-words leading-relaxed"
          disabled={loading}
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="copy-title" className="text-xs text-muted-foreground">
            제목 (선택)
          </label>
          <Input
            id="copy-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="비우면 첫 줄이 제목"
            disabled={loading}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <label
            htmlFor="copy-source"
            className="text-xs text-muted-foreground"
          >
            출처 URL (선택)
          </label>
          <Input
            id="copy-source"
            type="text"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://"
            disabled={loading}
          />
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <label htmlFor="copy-tags" className="text-xs text-muted-foreground">
            태그 (쉼표 구분)
          </label>
          <Input
            id="copy-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="SNS, 후킹"
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading} className="shrink-0">
          <Plus className="h-4 w-4" />
          {loading ? "저장 중…" : "추가"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
