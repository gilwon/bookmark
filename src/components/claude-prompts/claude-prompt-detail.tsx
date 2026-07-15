// Claude Prompt 상세 — 한글 번역 위 + 영문 원문 아래, 각각 복사
"use client";

import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  CLAUDE_PROMPTS_CREDIT,
  CLAUDE_PROMPTS_SOURCE,
  CLAUDE_PROMPTS_USAGE,
  claudePromptCategoryLabel,
  type ClaudePromptItem,
} from "@/lib/claude-prompts-kr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  item: ClaudePromptItem;
};

/** 상세 화면 복사 버튼 상태 */
function CopyBlock({
  label,
  text,
  emptyHint,
}: {
  label: string;
  text: string;
  emptyHint?: string;
}) {
  const [ok, setOk] = useState(false);
  const empty = !text.trim();

  async function onCopy() {
    if (empty) return;
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      window.setTimeout(() => setOk(false), 1200);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={empty}
          onClick={() => void onCopy()}
        >
          <Copy className="h-3.5 w-3.5" />
          {ok ? "복사됨" : "복사"}
        </Button>
      </div>
      {empty ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {emptyHint ?? "내용이 없습니다."}
        </p>
      ) : (
        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
          {text}
        </pre>
      )}
    </section>
  );
}

/** Claude Prompt 단건 상세 */
export function ClaudePromptDetail({ item }: Props) {
  const [bothOk, setBothOk] = useState(false);
  const bodyKo = item.promptKo?.trim() ?? "";
  const both = bodyKo
    ? `${bodyKo}\n\n---\n\n${item.prompt}`
    : item.prompt;

  async function copyBoth() {
    try {
      await navigator.clipboard.writeText(both);
      setBothOk(true);
      window.setTimeout(() => setBothOk(false), 1200);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Link
            href="/claude-prompts"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-indigo-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            목록으로
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              #{item.displayId}
            </span>
            <Badge variant="secondary">
              {claudePromptCategoryLabel(item.category)}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {item.titleKo || item.title}
          </h1>
          <p className="text-sm text-muted-foreground">{item.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void copyBoth()}>
            <Copy className="h-4 w-4" />
            {bothOk ? "복사됨" : "한글+영문 복사"}
          </Button>
          <a
            href={CLAUDE_PROMPTS_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button type="button" variant="secondary">
              <ExternalLink className="h-4 w-4" />
              원본
            </Button>
          </a>
        </div>
      </div>

      <p
        className="inline-flex w-full max-w-xl items-start gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-sm font-medium text-amber-900 dark:text-amber-100"
        title={CLAUDE_PROMPTS_USAGE}
      >
        <span
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
          aria-hidden
        />
        <span>
          <strong className="font-semibold">사용법</strong>
          {" · "}
          <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[13px]">
            [...]
          </code>{" "}
          대괄호 부분만 본인 상황에 맞게 바꿔주세요.
        </span>
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {CLAUDE_PROMPTS_CREDIT}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CopyBlock
            label="한글 번역"
            text={bodyKo}
            emptyHint="한글 번역을 준비 중입니다. 잠시 후 새로고침해 주세요."
          />
          <CopyBlock label="English (원문)" text={item.prompt} />
        </CardContent>
      </Card>
    </div>
  );
}
