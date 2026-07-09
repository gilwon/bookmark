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
        "relative flex flex-col transition-colors hover:border-border",
        selected && "border-indigo-500 ring-1 ring-indigo-500/40"
      )}
    >
      {selectable && (
        <label
          className="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-background/90 shadow border border-border"
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          <a
            href={star.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-indigo-300"
          >
            {star.repoFullName}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </a>
        </CardTitle>
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
