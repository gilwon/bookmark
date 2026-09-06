// 평문 본문의 URL을 새 탭 링크로 그린다
"use client";

import { splitLinkifyParts } from "@/lib/linkify-text";

const LINK_CLASS =
  "text-indigo-500 underline underline-offset-2 break-all hover:text-indigo-400";

export function LinkifiedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = splitLinkifyParts(text);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
            onClick={(e) => e.stopPropagation()}
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  );
}
