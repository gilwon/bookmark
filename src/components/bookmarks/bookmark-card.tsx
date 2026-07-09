// 북마크 카드 — OG 이미지, 제목, 태그, 선택/삭제
"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Bookmark } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  bookmark: Bookmark;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

/** 단일 북마크를 카드로 렌더링한다. */
export function BookmarkCard({
  bookmark,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const hasImage = Boolean(bookmark.image);

  async function handleDelete() {
    if (!confirm("이 북마크를 삭제할까요?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  let domain = "";
  try {
    domain = new URL(bookmark.url).hostname;
  } catch {
    domain = bookmark.url;
  }

  /** 선택 체크 — 이미지 위(absolute) 또는 제목 옆(inline) */
  const selectControl = selectable ? (
    <label
      className={cn(
        "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background/90 shadow",
        hasImage && "absolute left-2 top-2 z-10"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        className="h-4 w-4 accent-indigo-600"
        checked={Boolean(selected)}
        onChange={onToggleSelect}
        aria-label={`${bookmark.title} 선택`}
      />
    </label>
  ) : null;

  return (
    <Card
      className={cn(
        "group relative flex flex-col overflow-hidden transition-colors hover:border-border",
        selected && "border-indigo-500 ring-1 ring-indigo-500/40"
      )}
    >
      {hasImage ? (
        <div className="relative">
          {selectControl}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bookmark.image!}
            alt=""
            className="h-36 w-full object-cover bg-muted"
          />
        </div>
      ) : (
        <div className="relative flex h-28 items-center justify-center bg-muted/60 text-sm text-muted-foreground">
          이미지 없음
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          {/* 이미지 없을 때 체크박스를 제목 앞에 두어 겹침 방지 */}
          {!hasImage && selectControl}
          {bookmark.favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bookmark.favicon}
              alt=""
              className="mt-0.5 h-4 w-4 shrink-0 rounded-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <CardTitle className="min-w-0 flex-1 line-clamp-2 text-sm leading-snug">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-300"
            >
              {bookmark.title}
            </a>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {bookmark.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {bookmark.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {bookmark.category && (
            <Badge variant="secondary">{bookmark.category}</Badge>
          )}
          {bookmark.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="truncate text-xs text-muted-foreground">{domain}</span>
          <div className="flex gap-1 opacity-70 group-hover:opacity-100">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
              aria-label="열기"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:text-red-300"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
