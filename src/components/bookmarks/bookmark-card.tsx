// 북마크 카드 — OG 이미지, 제목, 태그, 삭제
"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Bookmark } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 단일 북마크를 카드로 렌더링한다. */
export function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  /** 북마크 삭제 API 호출 */
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

  return (
    <Card className="group flex flex-col overflow-hidden transition-colors hover:border-zinc-700">
      {bookmark.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bookmark.image}
          alt=""
          className="h-36 w-full object-cover bg-zinc-800"
        />
      ) : (
        <div className="flex h-36 items-center justify-center bg-zinc-800/60 text-zinc-600 text-sm">
          이미지 없음
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
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
          <CardTitle className="line-clamp-2 text-sm leading-snug">
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
          <p className="line-clamp-2 text-xs text-zinc-400">
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
          <span className="truncate text-xs text-zinc-500">{domain}</span>
          <div className="flex gap-1 opacity-70 group-hover:opacity-100">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-800"
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
