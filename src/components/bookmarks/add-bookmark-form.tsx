// 북마크 추가 폼 — URL, 태그, 카테고리
"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** URL을 받아 메타 추출 후 북마크를 생성한다. */
export function AddBookmarkForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 폼 제출 — POST /api/bookmarks */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("URL을 입력하세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          category: category.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "저장에 실패했습니다.");
      }
      setUrl("");
      setTags("");
      setCategory("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-1">
        <label className="text-xs text-zinc-400">URL</label>
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
        />
      </div>
      <div className="w-full space-y-1 sm:w-40">
        <label className="text-xs text-zinc-400">태그 (쉼표 구분)</label>
        <Input
          placeholder="react, 문서"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>
      <div className="w-full space-y-1 sm:w-36">
        <label className="text-xs text-zinc-400">카테고리</label>
        <Input
          placeholder="자동"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="shrink-0">
        <Plus className="h-4 w-4" />
        {loading ? "저장 중…" : "추가"}
      </Button>
      {error && (
        <p className="w-full text-xs text-red-400 sm:basis-full">{error}</p>
      )}
    </form>
  );
}
