// 프롬프트를 노션형 블록 문서와 속성으로 편집한다
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { TiptapEditor } from "@/components/pages/tiptap-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { markdownToTiptapDoc } from "@/lib/markdown-to-tiptap";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { Prompt } from "@/lib/types";

type Props = { initial: Prompt };

function legacySectionsToDocument(prompt: Prompt): unknown {
  const structured = prompt.sections.find(
    (section) => section.content && typeof section.content === "object"
  )?.content;
  if (structured) return structured;

  const markdown = prompt.sections
    .map((section) => `## ${section.title}\n\n${section.body}`)
    .join("\n\n");
  return markdownToTiptapDoc(markdown);
}

/** 기존 섹션 데이터도 읽을 수 있는 노션형 프롬프트 편집기. */
export function PromptEditor({ initial }: Props) {
  const [category, setCategory] = useState(initial.category ?? "");
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [whenToUse, setWhenToUse] = useState(initial.whenToUse ?? "");
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const metadataRef = useRef({
    category: initial.category ?? "",
    summary: initial.summary ?? "",
    whenToUse: initial.whenToUse ?? "",
  });
  const initialContent = useMemo(() => legacySectionsToDocument(initial), [initial]);

  const markMetadataDirty = useCallback(() => {
    setDirtyVersion((version) => version + 1);
  }, []);

  const saveDocument = useCallback(
    async ({ title, content }: { title: string; content: unknown }) => {
      const metadata = metadataRef.current;
      const res = await fetch(`/api/prompts/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category: metadata.category.trim() || null,
          summary: metadata.summary.trim() || null,
          whenToUse: metadata.whenToUse.trim() || null,
          sections: [
            {
              title: "프롬프트 문서",
              body: tiptapToMarkdown(content),
              content,
            },
          ],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        updatedAt?: string;
      };
      if (!res.ok) throw new Error(data.error || "저장 실패");
      return { updatedAt: data.updatedAt };
    },
    [initial.id]
  );

  return (
    <div className="w-full min-w-0">
      <details className="mb-4 rounded-md border border-border bg-card/40 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          속성
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">카테고리</span>
            <Input
              value={category}
              onChange={(event) => {
                const value = event.target.value;
                setCategory(value);
                metadataRef.current.category = value;
                markMetadataDirty();
              }}
              placeholder="예: Claude · 업무 자동화"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">한 줄 요약</span>
            <Input
              value={summary}
              onChange={(event) => {
                const value = event.target.value;
                setSummary(value);
                metadataRef.current.summary = value;
                markMetadataDirty();
              }}
              placeholder="이 프롬프트가 하는 일을 적으세요"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">이런 상황에 사용해요</span>
            <Textarea
              value={whenToUse}
              onChange={(event) => {
                const value = event.target.value;
                setWhenToUse(value);
                metadataRef.current.whenToUse = value;
                markMetadataDirty();
              }}
              placeholder="언제 이 프롬프트를 쓰면 좋은지 적으세요"
              className="min-h-20"
            />
          </label>
        </div>
      </details>

      <TiptapEditor
        pageId={initial.id}
        initialTitle={initial.title}
        initialContent={initialContent}
        initialUpdatedAt={initial.updatedAt}
        onSaveDocument={saveDocument}
        externalDirtyVersion={dirtyVersion}
        titlePlaceholder="제목 없는 프롬프트"
      />
    </div>
  );
}
