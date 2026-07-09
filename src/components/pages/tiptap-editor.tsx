// 노션형 페이지 에디터 — 제목·본문 연속 입력, 서식 툴바, 자동/수동 저장
"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Check,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  MessageSquareWarning,
  Quote,
  Redo2,
  Save,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Bookmark, GithubStar } from "@/lib/types";
import {
  migrateAsideInTiptapDoc,
  pastedAsideToNodes,
} from "@/lib/migrate-aside-content";
import { hasLiteralAside } from "@/lib/normalize-to-markdown";
import { CalloutBlock } from "@/components/pages/extensions/callout-block";
import { EmbedBlock } from "@/components/pages/extensions/embed-block";
import type { EmbedAttrs } from "@/components/pages/extensions/embed-types";
import {
  BlockHandle,
  useBlockDragDrop,
} from "@/components/pages/block-handle";
import { EmbedPicker } from "@/components/pages/embed-picker";
import { SlashMenu } from "@/components/pages/slash-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  pageId: string;
  initialTitle: string;
  initialContent: unknown;
  initialUpdatedAt?: string;
  bookmarks: Bookmark[];
  stars: GithubStar[];
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/** 페이지 제목/본문을 노션처럼 편집·자동 저장한다. */
export function TiptapEditor({
  pageId,
  initialTitle,
  initialContent,
  initialUpdatedAt,
  bookmarks,
  stars,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialUpdatedAt ?? null
  );
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const titleValueRef = useRef(title);
  titleValueRef.current = title;
  const editorRef = useRef<Editor | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);

  /** 저장된 문서 안 리터럴 <aside> 를 callout 노드로 승격 */
  const seed = useMemo(() => {
    const base =
      initialContent && typeof initialContent === "object"
        ? initialContent
        : { type: "doc", content: [{ type: "paragraph" }] };
    return migrateAsideInTiptapDoc(base);
  }, [initialContent]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "글을 입력하거나, 서식 도구로 꾸며 보세요…",
        emptyEditorClass: "is-editor-empty",
        emptyNodeClass: "is-empty",
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-indigo-500 underline underline-offset-2" },
      }),
      CalloutBlock,
      EmbedBlock,
    ],
    content: seed.content as object,
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
    },
    editorProps: {
      attributes: {
        class:
          "notion-editor ProseMirror max-w-none min-h-[60vh] focus:outline-none",
      },
      /**
       * 클립보드에 보이는 <aside> 문자열이 있으면 콜아웃 노드로 삽입.
       * (plain text / HTML 모두 처리)
       */
      handlePaste(_view, event) {
        const html = event.clipboardData?.getData("text/html") ?? "";
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const raw = html.trim() || text;
        if (!raw || !/aside/i.test(raw)) return false;
        // 리터럴 태그 또는 HTML aside 만 가로챔
        if (!hasLiteralAside(raw) && !/<aside\b/i.test(raw)) return false;

        event.preventDefault();
        const nodes = pastedAsideToNodes(raw);
        const ed = editorRef.current;
        if (ed && nodes.length > 0) {
          ed.chain().focus().insertContent(nodes).run();
          dirtyRef.current = true;
          setSaveState("dirty");
        }
        return true;
      },
    },
    immediatelyRender: false,
  });

  // 시드 마이그레이션이 있었으면 자동 저장 대상
  useEffect(() => {
    if (seed.changed) {
      dirtyRef.current = true;
      setSaveState("dirty");
    }
  }, [seed.changed]);

  /** 제목 높이 자동 조절 */
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 48)}px`;
  }, [title]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveState((s) => (s === "saving" ? s : "dirty"));
  }, []);

  // 블록 드래그 앤 드롭
  useBlockDragDrop(editor, markDirty);

  /** 제목 + 본문 저장 */
  const save = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!editor) return;
      if (!dirtyRef.current && opts?.silent) return;

      setSaveState("saving");
      try {
        const res = await fetch(`/api/pages/${pageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titleValueRef.current.trim() || "제목 없는 페이지",
            content: editor.getJSON(),
          }),
        });
        if (!res.ok) throw new Error("저장 실패");
        dirtyRef.current = false;
        const now = new Date().toISOString();
        setLastSavedAt(now);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [editor, pageId]
  );

  // 본문 변경 → dirty
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => markDirty();
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, markDirty]);

  // dirty 후 1.2초 debounce 자동 저장
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => {
      void save({ silent: false });
    }, 1200);
    return () => clearTimeout(t);
  }, [saveState, save, title]);

  // Cmd/Ctrl+S 수동 저장
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        dirtyRef.current = true;
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // 페이지 이탈 전 저장 유도
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function handleEmbed(attrs: EmbedAttrs) {
    if (!editor) return;
    editor.chain().focus().insertEmbed(attrs).run();
    markDirty();
  }

  function runFormat(cmd: () => void) {
    cmd();
    markDirty();
  }

  const statusLabel =
    saveState === "saving"
      ? "저장 중…"
      : saveState === "saved"
        ? "저장됨"
        : saveState === "dirty"
          ? "수정됨"
          : saveState === "error"
            ? "저장 실패"
            : lastSavedAt
              ? `저장 ${new Date(lastSavedAt).toLocaleString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "준비됨";

  return (
    // 상단 네비와 같이 앱 셸 전체 폭(max-w-6xl) 사용
    <div className="w-full min-w-0">
      {/* 상단 고정 툴바 */}
      <div className="sticky top-0 z-20 -mx-1 mb-6 border-b border-border/80 bg-background/90 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarBtn
            label="실행 취소"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
          >
            <Undo2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="다시 실행"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
          >
            <Redo2 className="h-4 w-4" />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn
            label="굵게"
            active={editor?.isActive("bold")}
            onClick={() =>
              runFormat(() => editor?.chain().focus().toggleBold().run())
            }
          >
            <Bold className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="기울임"
            active={editor?.isActive("italic")}
            onClick={() =>
              runFormat(() => editor?.chain().focus().toggleItalic().run())
            }
          >
            <Italic className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="취소선"
            active={editor?.isActive("strike")}
            onClick={() =>
              runFormat(() => editor?.chain().focus().toggleStrike().run())
            }
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="인라인 코드"
            active={editor?.isActive("code")}
            onClick={() =>
              runFormat(() => editor?.chain().focus().toggleCode().run())
            }
          >
            <Code className="h-4 w-4" />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn
            label="제목 1"
            active={editor?.isActive("heading", { level: 1 })}
            onClick={() =>
              runFormat(() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()
              )
            }
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="제목 2"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() =>
              runFormat(() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              )
            }
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="제목 3"
            active={editor?.isActive("heading", { level: 3 })}
            onClick={() =>
              runFormat(() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              )
            }
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn
            label="글머리 목록"
            active={editor?.isActive("bulletList")}
            onClick={() =>
              runFormat(() =>
                editor?.chain().focus().toggleBulletList().run()
              )
            }
          >
            <List className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="번호 목록"
            active={editor?.isActive("orderedList")}
            onClick={() =>
              runFormat(() =>
                editor?.chain().focus().toggleOrderedList().run()
              )
            }
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="인용"
            active={editor?.isActive("blockquote")}
            onClick={() =>
              runFormat(() =>
                editor?.chain().focus().toggleBlockquote().run()
              )
            }
          >
            <Quote className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label="콜아웃 (aside)"
            active={editor?.isActive("callout")}
            onClick={() =>
              runFormat(() => editor?.chain().focus().toggleCallout().run())
            }
          >
            <MessageSquareWarning className="h-4 w-4" />
          </ToolbarBtn>
          <Sep />
          <EmbedPicker
            bookmarks={bookmarks}
            stars={stars}
            onPick={handleEmbed}
            open={embedOpen}
            onOpenChange={setEmbedOpen}
          />
          <div className="ml-auto flex items-center gap-2 pl-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                saveState === "error"
                  ? "text-red-400"
                  : saveState === "saved"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
              )}
            >
              {saveState === "saved" && <Check className="h-3.5 w-3.5" />}
              {statusLabel}
            </span>
            <Button
              size="sm"
              variant={saveState === "dirty" ? "default" : "secondary"}
              disabled={saveState === "saving" || !editor}
              onClick={() => {
                dirtyRef.current = true;
                void save();
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {saveState === "saving" ? "저장 중" : "저장"}
            </Button>
          </div>
        </div>
      </div>

      {/*
        노션형 문서 캔버스
        - 폼 박스/점선 테두리 없이 연속된 문서 느낌
        - 제목은 큰 글씨, 본문은 그 아래 자연스럽게 이어짐
      */}
      <div className="notion-page pb-32">
        <div className="notion-page-inner">
          <textarea
            id="page-title-input"
            ref={titleRef}
            value={title}
            rows={1}
            placeholder="제목 없음"
            aria-label="페이지 제목"
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.chain().focus("start").run();
              }
            }}
            className="notion-title-input"
          />

          <div
            ref={bodyWrapRef}
            className="notion-body relative pl-10 sm:pl-12"
            onClick={(e) => {
              // 여백 클릭 시에도 본문 포커스 (노션과 유사)
              if (e.target === e.currentTarget) {
                editor?.chain().focus("end").run();
              } else if (!editor?.isFocused) {
                editor?.chain().focus().run();
              }
            }}
          >
            <BlockHandle
              editor={editor}
              containerRef={bodyWrapRef}
              onDirty={markDirty}
            />
            <EditorContent editor={editor} />
            <SlashMenu
              editor={editor}
              onRequestEmbed={() => setEmbedOpen(true)}
              onRanCommand={markDirty}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

function ToolbarBtn({
  children,
  label,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        active && "bg-indigo-600/15 text-indigo-600 dark:text-indigo-300"
      )}
    >
      {children}
    </button>
  );
}
