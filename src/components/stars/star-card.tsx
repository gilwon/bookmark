// GitHub Star 카드 + 선택 체크
"use client";

import { ExternalLink, Star } from "lucide-react";
import type { GithubStar } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
  return (
    <Card
      className={cn(
        "flex flex-col transition-colors hover:border-border",
        selected && "border-indigo-500 ring-1 ring-indigo-500/40"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          {/* absolute 대신 인라인 배치 — 제목과 겹치지 않음 */}
          {selectable && (
            <label
              className="mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background shadow"
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
          <CardTitle className="min-w-0 flex-1 text-sm">
            <a
              href={star.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-indigo-300"
            >
              <span className="break-all">{star.repoFullName}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
            </a>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {star.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {star.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {star.language && <Badge variant="default">{star.language}</Badge>}
          <Badge variant="secondary" className="gap-1">
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
