// 페이지 상세 상단 — 별·태그·원문 URL
"use client";

import { Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pushRecentPageId } from "@/lib/recent-pages";
import { cn } from "@/lib/utils";

type Props = {
  pageId: string;
  initialTags: string[];
  initialSourceUrl: string | null;
  initialIsFavorite: boolean;
};

async function patchPage(
  pageId: string,
  body: { tags?: string[]; sourceUrl?: string | null; isFavorite?: boolean }
): Promise<string | null> {
  try {
    const res = await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error?.trim() || "저장에 실패했습니다.";
  } catch {
    return "저장에 실패했습니다.";
  }
}

/** 별·태그·원문을 수정한다. expectedUpdatedAt은 보내지 않는다. */
export function PageMetaBar({
  pageId,
  initialTags,
  initialSourceUrl,
  initialIsFavorite,
}: Props) {
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [sourceDraft, setSourceDraft] = useState(initialSourceUrl ?? "");
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushRecentPageId(pageId);
  }, [pageId]);

  async function applyPatch(
    body: { tags?: string[]; sourceUrl?: string | null; isFavorite?: boolean },
    onFail?: () => void
  ) {
    setSaving(true);
    setError(null);
    const msg = await patchPage(pageId, body);
    setSaving(false);
    if (msg) {
      setError(msg);
      onFail?.();
    }
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) {
      setTagInput("");
      return;
    }
    const next = [...tags, tag];
    setTags(next);
    setTagInput("");
    void applyPatch({ tags: next }, () => setTags(tags));
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    void applyPatch({ tags: next }, () => setTags(tags));
  }

  function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    void applyPatch({ isFavorite: next }, () => setIsFavorite(!next));
  }

  function saveSource() {
    const trimmed = sourceDraft.trim();
    const next = trimmed ? trimmed : null;
    const prev = sourceUrl;
    setSourceUrl(next);
    void applyPatch({ sourceUrl: next }, () => {
      setSourceUrl(prev);
      setSourceDraft(prev ?? "");
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            isFavorite ? "text-amber-500" : "text-muted-foreground"
          )}
          onClick={() => toggleFavorite()}
          disabled={saving}
          title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
          aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
          aria-pressed={isFavorite}
        >
          <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
        </Button>
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              className="rounded p-0.5 hover:bg-muted"
              onClick={() => removeTag(tag)}
              disabled={saving}
              aria-label={`${tag} 제거`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addTag(tagInput);
          }}
          placeholder="태그 추가"
          aria-label="태그 추가"
          disabled={saving}
          className="h-8 max-w-[12rem]"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-full truncate text-xs text-muted-foreground hover:underline"
          >
            {sourceUrl}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">원문 없음</span>
        )}
        <Input
          value={sourceDraft}
          onChange={(e) => setSourceDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            saveSource();
          }}
          placeholder="원문 URL"
          aria-label="원문 URL"
          disabled={saving}
          className="h-8 min-w-[12rem] flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => saveSource()}
          disabled={saving}
        >
          저장
        </Button>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
