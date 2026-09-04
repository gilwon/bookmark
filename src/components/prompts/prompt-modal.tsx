// 프롬프트 상세 팝업 — 네이티브 dialog로 섹션 읽기·복사·삭제
"use client";

import { Copy, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Prompt } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  prompt: Prompt | null;
  onClose: () => void;
  onDeleted: () => void;
};

/** 섹션이 1개면 그 본문, 여러 개면 제목+본문을 이어 붙인 전체 텍스트 */
function fullCopyText(p: Prompt): string {
  if (p.sections.length <= 1) return p.sections[0]?.body ?? "";
  return p.sections
    .map((s) => `## ${s.title}\n\n${s.body}`)
    .join("\n\n---\n\n");
}

/** 프롬프트 카드를 클릭하면 뜨는 상세 팝업 */
export function PromptModal({ prompt, onClose, onDeleted }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSection, setCopiedSection] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (prompt) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (dialog.open) {
      dialog.close();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [prompt]);

  async function copyText(text: string, mark: () => void) {
    try {
      await navigator.clipboard.writeText(text);
      mark();
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!prompt) return;
    if (!confirm("이 프롬프트를 삭제할까요?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}`, {
        method: "DELETE",
      });
      if (res.ok) onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  // 닫힌 상태에서도 dialog 엘리먼트는 유지해 close 애니메이션·이벤트가 끊기지 않게 한다
  const cat = prompt?.category?.trim() || null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-border bg-background p-0 text-foreground shadow-[var(--shadow-popover)] backdrop:bg-black/45"
    >
      {prompt && (
        <div className="flex max-h-[90vh] flex-col">
          {/* 헤더 */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {cat && (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                >
                  {cat}
                </Badge>
              )}
              {prompt.isFavorite && (
                <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-100">
                  <Star className="mr-1 h-3 w-3 fill-current" />
                  즐겨찾기
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 본문 */}
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">{prompt.title}</h2>
              {prompt.summary && (
                <p className="text-sm text-muted-foreground">
                  {prompt.summary}
                </p>
              )}
              {prompt.whenToUse && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    이런 상황에 사용해요
                  </p>
                  <p className="text-sm text-foreground/90">
                    {prompt.whenToUse}
                  </p>
                </div>
              )}
            </div>

            {prompt.sections.map((sec, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {sec.title}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(sec.body, () => {
                        setCopiedSection(i);
                        setTimeout(() => setCopiedSection(null), 1500);
                      })
                    }
                    disabled={!sec.body}
                    className={cn(
                      "rounded text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      copiedSection === i && "text-emerald-500"
                    )}
                  >
                    {copiedSection === i ? "복사됨" : "복사"}
                  </button>
                </div>
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-4 font-mono text-sm leading-relaxed">
                  {sec.body || (
                    <span className="text-muted-foreground">
                      (내용 없음)
                    </span>
                  )}
                </pre>
              </div>
            ))}
          </div>

          {/* 푸터 */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                수정 {new Date(prompt.updatedAt).toLocaleString("ko-KR")}
              </p>
              <Link
                href={`/prompts/${prompt.id}/edit`}
                className="rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                수정
              </Link>
              <Link
                href={`/prompts/${prompt.id}`}
                className="rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                상세
              </Link>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                삭제
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                void copyText(fullCopyText(prompt), () => {
                  setCopiedAll(true);
                  setTimeout(() => setCopiedAll(false), 1500);
                })
              }
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Copy className={cn("h-4 w-4", copiedAll && "text-emerald-400")} />
              {copiedAll ? "복사됨" : "프롬프트 복사"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
