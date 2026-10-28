"use client";
// 김스듴 가이드 본문 마크다운을 정화해 HTML로 렌더한다.

import { Check, Copy } from "lucide-react";
import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";

type GuideBlock =
  | { kind: "md"; text: string }
  | { kind: "code"; text: string };

/** 펜스 코드 블록을 프롬프트로 분리한다. 짝이 없는 펜스는 본문으로 남긴다. */
function splitGuideBlocks(markdown: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  const fence = /^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  let lastIndex = 0;
  for (const match of markdown.matchAll(fence)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      blocks.push({ kind: "md", text: markdown.slice(lastIndex, start) });
    }
    blocks.push({ kind: "code", text: match[1].replace(/\n$/, "") });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < markdown.length) {
    blocks.push({ kind: "md", text: markdown.slice(lastIndex) });
  }
  if (blocks.length === 0) blocks.push({ kind: "md", text: markdown });
  return blocks;
}

const guideBodyClass = cn(
  "text-sm leading-relaxed break-words text-foreground",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_h4]:mt-3 [&_h4]:mb-1.5 [&_h4]:text-sm [&_h4]:font-semibold",
  "[&_h5]:mt-3 [&_h5]:mb-1 [&_h5]:text-sm [&_h5]:font-semibold",
  "[&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:text-sm [&_h6]:font-medium",
  "[&_p]:my-2",
  "[&_a]:text-indigo-600 [&_a]:underline-offset-2 hover:[&_a]:underline dark:[&_a]:text-indigo-400",
  "[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg",
  "[&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-hidden [&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-3",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]",
  "[&_pre_code]:whitespace-pre-wrap [&_pre_code]:wrap-anywhere [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_table]:my-3 [&_table]:w-full [&_table]:text-left [&_table]:text-xs",
  "[&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium",
  "[&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5",
  "[&_hr]:my-4 [&_hr]:border-border"
);

/** 프롬프트 상자. 복사 버튼은 본문과 따로 두고, 펜스 안 글만 클립보드에 넣는다. */
function PromptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  return (
    <div className="my-3 rounded-lg border border-border bg-muted">
      <div className="flex justify-end px-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 bg-background px-3 text-xs"
          onClick={() => void onCopy()}
          aria-label={copied ? "프롬프트가 복사됨" : "프롬프트 복사"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span aria-live="polite">{copied ? "복사됨" : "복사"}</span>
        </Button>
      </div>
      <pre className="max-w-full overflow-x-hidden whitespace-pre-wrap wrap-anywhere px-3 pb-3 text-[13px] leading-relaxed text-foreground">
        {text}
      </pre>
    </div>
  );
}

/** 가이드 마크다운을 클라이언트에서만 HTML로 변환한다. */
export function GuideBody({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => splitGuideBlocks(markdown), [markdown]);
  const [htmlByIndex, setHtmlByIndex] = useState<Record<number, string> | null>(null);

  useEffect(() => {
    try {
      const next: Record<number, string> = {};
      for (const [index, block] of blocks.entries()) {
        if (block.kind !== "md") continue;
        const raw = marked.parse(block.text, {
          gfm: true,
          breaks: false,
          async: false,
        }) as string;
        next[index] = sanitizeHtml(raw);
      }
      setHtmlByIndex(next);
    } catch {
      setHtmlByIndex({});
    }
  }, [blocks]);

  if (htmlByIndex === null) {
    return <p className="text-sm text-muted-foreground">렌더 중…</p>;
  }

  const proseFailed = Object.keys(htmlByIndex).length === 0 && blocks.every((block) => block.kind === "md");
  if (proseFailed) {
    return <PromptBlock text={markdown} />;
  }

  return (
    <div className="min-w-0 max-w-full">
      {blocks.map((block, index) => {
        if (block.kind === "code") return <PromptBlock key={index} text={block.text} />;
        const html = htmlByIndex[index];
        if (!html) return null;
        return <div key={index} className={guideBodyClass} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}
