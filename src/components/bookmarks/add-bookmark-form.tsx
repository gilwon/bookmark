// 북마크 추가 폼 — URL, 태그, 카테고리(기존 목록 선택)
"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  /** 기존 카테고리 이름 목록 */
  categories?: string[];
};

const selectClass =
  "flex h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** URL을 받아 메타 추출 후 북마크를 생성한다. */
export function AddBookmarkForm({ categories = [] }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  /** "" = 자동(URL 기반), "__new__" = 직접 입력 */
  const [categoryMode, setCategoryMode] = useState<string>("");
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resolveCategory(): string | undefined {
    if (categoryMode === "__new__") {
      const n = newCategory.trim();
      return n || undefined;
    }
    if (categoryMode) return categoryMode;
    return undefined;
  }

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
          category: resolveCategory(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          (data as { error?: string }).error ||
          (res.status === 409
            ? "이미 등록된 주소입니다."
            : "저장에 실패했습니다.");
        throw new Error(msg);
      }
      setUrl("");
      setTags("");
      setCategoryMode("");
      setNewCategory("");
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
      className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="min-w-[200px] flex-1 space-y-1">
        <label className="text-xs text-muted-foreground">URL</label>
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
        />
      </div>
      <div className="w-full space-y-1 sm:w-40">
        <label className="text-xs text-muted-foreground">태그 (쉼표 구분)</label>
        <Input
          placeholder="react, 문서"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>
      <div className="w-full space-y-1 sm:w-44">
        <label className="text-xs text-muted-foreground">카테고리</label>
        <select
          value={categoryMode}
          onChange={(e) => setCategoryMode(e.target.value)}
          className={selectClass}
          disabled={loading}
        >
          <option value="">자동 (URL 기반)</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="__new__">+ 새 카테고리…</option>
        </select>
      </div>
      {categoryMode === "__new__" && (
        <div className="w-full space-y-1 sm:w-40">
          <label className="text-xs text-muted-foreground">새 이름</label>
          <Input
            placeholder="카테고리 이름"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            disabled={loading}
          />
        </div>
      )}
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
