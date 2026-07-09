// 프롬프트 상세 — 첨부 이미지형 메타 + 섹션 블록 읽기/복사
"use client";

import {
  BookOpen,
  Copy,
  MessageSquareText,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Prompt } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 등록된 프롬프트를 상세 레이아웃으로 표시한다. */
export function PromptDetail({ prompt }: { prompt: Prompt }) {
  const router = useRouter();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function copyText(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!confirm("이 프롬프트를 삭제할까요?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/prompts");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="w-full min-w-0 space-y-8">
      <header className="space-y-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {prompt.title}
          </h1>
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/prompts/${prompt.id}/edit`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-xs font-medium hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" />
              수정
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </Button>
          </div>
        </div>

        <dl className="space-y-2.5 text-sm">
          {prompt.category && (
            <div className="flex flex-wrap items-center gap-2">
              <dt className="flex w-36 shrink-0 items-center gap-1.5 text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                목차
              </dt>
              <dd>
                <Badge className="border-amber-500/30 bg-amber-500/15 font-normal text-amber-900 dark:text-amber-100">
                  {prompt.category}
                </Badge>
              </dd>
            </div>
          )}
          {prompt.summary && (
            <div className="flex flex-wrap items-start gap-2">
              <dt className="flex w-36 shrink-0 items-center gap-1.5 text-muted-foreground">
                <MessageSquareText className="h-3.5 w-3.5" />
                프롬프트
              </dt>
              <dd className="min-w-0 flex-1 text-foreground/90">
                {prompt.summary}
              </dd>
            </div>
          )}
          {prompt.whenToUse && (
            <div className="flex flex-wrap items-start gap-2">
              <dt className="flex w-36 shrink-0 items-center gap-1.5 text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                이런 상황에 사용해요
              </dt>
              <dd className="min-w-0 flex-1 text-foreground/90">
                {prompt.whenToUse}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <div className="space-y-6">
        {prompt.sections.map((sec, i) => (
          <section key={i} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{sec.title}</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void copyText(sec.body, i)}
                disabled={!sec.body}
              >
                <Copy
                  className={cn(
                    "h-3.5 w-3.5",
                    copiedIdx === i && "text-emerald-500"
                  )}
                />
                {copiedIdx === i ? "복사됨" : "복사"}
              </Button>
            </div>
            <pre
              className={cn(
                "max-h-[min(70vh,640px)] overflow-auto whitespace-pre-wrap break-words",
                "rounded-xl border border-border bg-input px-4 py-4",
                "font-mono text-[13px] leading-relaxed text-foreground",
                "shadow-inner"
              )}
            >
              {sec.body || (
                <span className="text-muted-foreground">(내용 없음)</span>
              )}
            </pre>
          </section>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        수정 {new Date(prompt.updatedAt).toLocaleString("ko-KR")}
      </p>
    </article>
  );
}
