// 에디터 안 임베드 블록 시각 표현 (북마크 / GitHub Star)
"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Bookmark, ExternalLink, GitFork, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmbedAttrs } from "@/components/pages/extensions/embed-types";

/** Tiptap NodeView — 임베드 카드를 렌더하고 삭제할 수 있다. */
export function EmbedNodeView({ node, deleteNode, selected }: NodeViewProps) {
  const attrs = node.attrs as EmbedAttrs;
  const isStar = attrs.kind === "star";

  return (
    <NodeViewWrapper
      className="my-3"
      data-drag-handle
    >
      <div
        className={`group relative overflow-hidden rounded-xl border bg-background/80 transition-colors ${
          selected
            ? "border-indigo-500 ring-1 ring-indigo-500/40"
            : "border-border hover:border-border"
        }`}
      >
        <div className="flex gap-3 p-3">
          {attrs.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attrs.image}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg object-cover bg-muted"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {isStar ? (
                <GitFork className="h-6 w-6" />
              ) : (
                <Bookmark className="h-6 w-6" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {isStar ? "GitHub Star" : "북마크"}
              </Badge>
              {attrs.subtitle && (
                <span className="text-xs text-muted-foreground truncate">
                  {attrs.subtitle}
                </span>
              )}
            </div>
            <a
              href={attrs.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-indigo-300"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate">{attrs.title || "제목 없음"}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </a>
            {attrs.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {attrs.description}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteNode();
            }}
            aria-label="임베드 삭제"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
