// Star README 마크다운을 정화해 HTML로 렌더한다.
"use client";

import { marked } from "marked";
import { useEffect, useState } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";

const readmeClass = cn(
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
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-3",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_table]:my-3 [&_table]:w-full [&_table]:text-left [&_table]:text-xs",
  "[&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium",
  "[&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5",
  "[&_hr]:my-4 [&_hr]:border-border"
);

/** README 마크다운을 클라이언트에서만 HTML로 변환한다. */
export function StarReadme({ markdown }: { markdown: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = marked.parse(markdown, {
        gfm: true,
        breaks: false,
        async: false,
      }) as string;
      setHtml(sanitizeHtml(raw));
    } catch {
      setHtml("");
    }
  }, [markdown]);

  if (html === null) {
    return <p className="text-sm text-muted-foreground">렌더 중…</p>;
  }

  if (!html) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-sm text-foreground">
        {markdown}
      </pre>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className={readmeClass}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
