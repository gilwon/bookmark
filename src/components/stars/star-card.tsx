// GitHub Star 카드 + 신규/업데이트 뱃지
"use client";

import { ExternalLink, Pin, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GithubStar } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  star: GithubStar;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

/** Star된 레포지토리 정보를 카드로 표시한다. */
export function StarCard({
  star,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const router = useRouter();
  const [favoriting, setFavoriting] = useState(false);
  const isNew = star.changeKind === "new";
  const isUpdated = star.changeKind === "updated";
  const delta = star.starsDelta ?? 0;

  /** 즐겨찾기 on/off — 목록 상단 정렬에 반영 */
  async function toggleFavorite() {
    if (favoriting) return;
    setFavoriting(true);
    try {
      const res = await fetch(`/api/stars/${star.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !star.isFavorite }),
      });
      if (res.ok) router.refresh();
    } finally {
      setFavoriting(false);
    }
  }

  return (
    <Card
      className={cn(
        "relative flex flex-col transition-colors hover:border-border",
        isNew && "border-emerald-500/50",
        isUpdated && !isNew && !star.isFavorite && "border-amber-500/40",
        star.isFavorite &&
          "border-sky-300/80 [background:rgba(0,113,227,0.10)] hover:border-sky-400 dark:border-sky-500/45 dark:[background:rgba(41,151,255,0.14)]",
        selected && "border-indigo-500 ring-1 ring-indigo-500/40",
      )}
    >
      <Link
        href={`/stars/${star.id}`}
        prefetch={false}
        className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${star.repoFullName} 상세`}
      />
      <CardHeader className="relative z-10 pb-2">
        <div className="flex items-start gap-2">
          {selectable && (
            <label
              className="relative z-10 mt-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background shadow"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-600"
                checked={Boolean(selected)}
                onChange={onToggleSelect}
                aria-label={`${star.repoFullName} 선택`}
              />
            </label>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {isNew && (
                <Badge className="border-transparent bg-emerald-600/20 text-emerald-700 dark:text-emerald-300">
                  신규
                </Badge>
              )}
              {isUpdated && (
                <Badge className="border-transparent bg-amber-500/20 text-amber-800 dark:text-amber-200">
                  업데이트
                </Badge>
              )}
              {star.source === "manual" && (
                <Badge variant="outline" className="text-[10px]">
                  수동
                </Badge>
              )}
              {delta !== 0 && (
                <Badge variant="outline" className="tabular-nums">
                  ⭐ {delta > 0 ? `+${delta}` : delta}
                </Badge>
              )}
            </div>
            <CardTitle className="pointer-events-none text-sm">
              <span className="break-all">{star.repoFullName}</span>
            </CardTitle>
          </div>
          <a
            href={star.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-doc-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="GitHub에서 열기"
            aria-label={`${star.repoFullName} GitHub에서 열기`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "relative z-10 h-9 w-9 shrink-0",
              star.isFavorite ? "text-sky-600 opacity-100 dark:text-sky-400" : "text-muted-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              void toggleFavorite();
            }}
            disabled={favoriting}
            title={star.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
            aria-label={star.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
            aria-pressed={star.isFavorite}
          >
            <Pin
              className={cn("h-3.5 w-3.5", star.isFavorite && "fill-current")}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pointer-events-none relative z-10 flex flex-1 flex-col gap-3">
        {star.description && (
          <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {star.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {star.language && <Badge variant="default">{star.language}</Badge>}
          <Badge
            variant="outline"
            className="gap-1 border-amber-400/40 bg-amber-100/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100"
          >
            <Star className="h-3 w-3" />
            {star.stars.toLocaleString()}
          </Badge>
          {star.topics.slice(0, 4).map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
