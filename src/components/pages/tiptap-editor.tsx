// Tiptap 리치 텍스트 에디터 — StarterKit + Placeholder + Link
"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  pageId: string;
  initialTitle: string;
  initialContent: unknown;
};

/** 페이지 제목/본문을 편집하고 저장한다. */
export function TiptapEditor({ pageId, initialTitle, initialContent }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "내용을 입력하세요…",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-indigo-400 underline" },
      }),
    ],
    content:
      initialContent && typeof initialContent === "object"
        ? (initialContent as object)
        : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[320px] focus:outline-none px-1 py-2",
      },
    },
    immediatelyRender: false,
  });

  /** 제목과 에디터 JSON을 서버에 저장한다. */
  const save = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "제목 없는 페이지",
          content: editor.getJSON(),
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setStatus("저장됨");
    } catch {
      setStatus("저장 실패");
    } finally {
      setSaving(false);
    }
  }, [editor, pageId, title]);

  // 2초 debounce 자동 저장
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      setStatus("수정됨…");
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor]);

  useEffect(() => {
    if (status !== "수정됨…") return;
    const t = setTimeout(() => {
      void save();
    }, 1500);
    return () => clearTimeout(t);
  }, [status, save]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setStatus("수정됨…");
          }}
          className="text-lg font-semibold h-11"
          placeholder="페이지 제목"
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
          {status && (
            <span className="text-xs text-zinc-500 whitespace-nowrap">
              {status}
            </span>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
