// 검색 결과용 에이전트 문서 카드
import { Bot } from "lucide-react";
import Link from "next/link";
import {
  AGENT_DOC_KIND_COLOR,
  AGENT_DOC_KIND_LABEL,
} from "@/lib/agent-doc-templates";
import type { AgentDocKind } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AgentDocSearchResult = {
  id: string;
  title: string;
  filename: string;
  kind: AgentDocKind;
  fileCount?: number;
  snippet: string;
  updatedAt: string;
};

/** 검색된 에이전트 문서를 카드로 표시한다. */
export function AgentDocResultCard({
  doc,
}: {
  doc: AgentDocSearchResult;
}) {
  const kindColor =
    AGENT_DOC_KIND_COLOR[doc.kind] ?? AGENT_DOC_KIND_COLOR.other;

  return (
    <Card className="transition-colors hover:border-border">
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            kindColor.icon
          )}
        >
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={kindColor.badge}>
              {AGENT_DOC_KIND_LABEL[doc.kind] ?? "문서"}
            </Badge>
            {(doc.fileCount ?? 1) > 1 && (
              <Badge variant="outline">번들 · {doc.fileCount}파일</Badge>
            )}
            <code className="truncate text-xs text-muted-foreground">
              {doc.filename}
            </code>
          </div>
          <Link
            href={`/agent-docs/${doc.id}`}
            className="block truncate font-medium text-foreground hover:text-indigo-500"
          >
            {doc.title || doc.filename}
          </Link>
          {doc.snippet ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {doc.snippet}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            수정 {new Date(doc.updatedAt).toLocaleString("ko-KR")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
