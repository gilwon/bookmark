// GitHub Star 카드
import { ExternalLink, Star } from "lucide-react";
import type { GithubStar } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Star된 레포지토리 정보를 카드로 표시한다. */
export function StarCard({ star }: { star: GithubStar }) {
  return (
    <Card className="flex flex-col transition-colors hover:border-border">
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
          {star.language && (
            <Badge variant="default">{star.language}</Badge>
          )}
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
