// 노션형 텍스트 선택 버블 메뉴 — 블록 전환 + 인라인 서식
"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Check,
  ChevronDown,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareWarning,
  Quote,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type BlockKind =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "ordered"
  | "quote"
  | "callout"
  | "code";

type BlockOption = {
  id: BlockKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 드롭다운 왼쪽 작은 표기 (H1 등) */
  mark?: string;
};

const BLOCK_OPTIONS: BlockOption[] = [
  { id: "text", label: "텍스트", icon: Type, mark: "T" },
  { id: "h1", label: "제목1", icon: Heading1, mark: "H1" },
  { id: "h2", label: "제목2", icon: Heading2, mark: "H2" },
  { id: "h3", label: "제목3", icon: Heading3, mark: "H3" },
  { id: "bullet", label: "글머리 기호 목록", icon: List, mark: "•" },
  { id: "ordered", label: "번호 매기기 목록", icon: ListOrdered, mark: "1." },
  { id: "quote", label: "인용", icon: Quote, mark: "“" },
  { id: "callout", label: "콜아웃", icon: MessageSquareWarning, mark: "!" },
  { id: "code", label: "코드", icon: Code2, mark: "</>" },
];

function currentBlock(editor: Editor): BlockOption {
  if (editor.isActive("heading", { level: 1 })) return BLOCK_OPTIONS[1]!;
  if (editor.isActive("heading", { level: 2 })) return BLOCK_OPTIONS[2]!;
  if (editor.isActive("heading", { level: 3 })) return BLOCK_OPTIONS[3]!;
  if (editor.isActive("bulletList")) return BLOCK_OPTIONS[4]!;
  if (editor.isActive("orderedList")) return BLOCK_OPTIONS[5]!;
  if (editor.isActive("blockquote")) return BLOCK_OPTIONS[6]!;
  if (editor.isActive("callout")) return BLOCK_OPTIONS[7]!;
  if (editor.isActive("codeBlock")) return BLOCK_OPTIONS[8]!;
  return BLOCK_OPTIONS[0]!;
}

function applyBlock(editor: Editor, id: BlockKind) {
  const chain = editor.chain().focus();
  switch (id) {
    case "text":
      chain.setParagraph().run();
      break;
    case "h1":
      chain.setHeading({ level: 1 }).run();
      break;
    case "h2":
      chain.setHeading({ level: 2 }).run();
      break;
    case "h3":
      chain.setHeading({ level: 3 }).run();
      break;
    case "bullet":
      chain.toggleBulletList().run();
      break;
    case "ordered":
      chain.toggleOrderedList().run();
      break;
    case "quote":
      chain.toggleBlockquote().run();
      break;
    case "callout":
      chain.toggleCallout().run();
      break;
    case "code":
      chain.toggleCodeBlock().run();
      break;
  }
}

type Props = {
  editor: Editor | null;
  onDirty?: () => void;
};

/**
 * 텍스트 선택 시 노션처럼 떠 있는 서식 메뉴.
 * - 왼쪽: 블록 타입 전환 (텍스트 / 제목 / 목록 …)
 * - 오른쪽: 굵게·기울임·밑줄·취소선·코드·링크
 */
export function NotionBubbleMenu({ editor, onDirty }: Props) {
  const [turnOpen, setTurnOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const turnRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);

  const dirty = useCallback(() => onDirty?.(), [onDirty]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (turnRef.current && !turnRef.current.contains(t)) setTurnOpen(false);
      if (linkRef.current && !linkRef.current.contains(t)) setLinkOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!editor) return null;

  const block = currentBlock(editor);
  const BlockIcon = block.icon;

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: 8,
        flip: true,
        shift: true,
      }}
      shouldShow={({ editor: ed, state }) => {
        const { selection } = state;
        if (selection.empty) return false;
        // 코드 블록 안에서는 인라인 서식 위주 — 그래도 표시
        if (!ed.isEditable) return false;
        // 이미지만 선택 등은 제외
        return true;
      }}
      className="notion-bubble-menu z-50"
    >
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-xl border border-border/80 bg-card px-1 py-1 shadow-xl",
          "text-foreground"
        )}
        onMouseDown={(e) => {
          // 선택 유지
          e.preventDefault();
        }}
      >
        {/* 블록 전환 */}
        <div ref={turnRef} className="relative">
          <button
            type="button"
            title="블록 유형 변경"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors",
              "hover:bg-muted",
              turnOpen && "bg-muted ring-2 ring-indigo-500/40"
            )}
            onClick={() => {
              setLinkOpen(false);
              setTurnOpen((v) => !v);
            }}
          >
            <BlockIcon className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[7rem] truncate">{block.label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {turnOpen && (
            <div
              className={cn(
                "absolute left-0 top-[calc(100%+6px)] z-[60] w-56 overflow-hidden rounded-xl",
                "border border-border bg-card py-1 shadow-2xl"
              )}
              role="listbox"
              aria-label="블록 유형"
            >
              <p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                다음으로 전환
              </p>
              {BLOCK_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = opt.id === block.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-indigo-600/12 text-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() => {
                      applyBlock(editor, opt.id);
                      dirty();
                      setTurnOpen(false);
                    }}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-[10px] font-semibold text-muted-foreground">
                      {opt.mark ?? <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {active && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />

        {/* 인라인 서식 */}
        <FmtBtn
          label="굵게"
          active={editor.isActive("bold")}
          onClick={() => {
            editor.chain().focus().toggleBold().run();
            dirty();
          }}
        >
          <Bold className="h-4 w-4" />
        </FmtBtn>
        <FmtBtn
          label="기울임"
          active={editor.isActive("italic")}
          onClick={() => {
            editor.chain().focus().toggleItalic().run();
            dirty();
          }}
        >
          <Italic className="h-4 w-4" />
        </FmtBtn>
        <FmtBtn
          label="밑줄"
          active={editor.isActive("underline")}
          onClick={() => {
            editor.chain().focus().toggleUnderline().run();
            dirty();
          }}
        >
          <UnderlineIcon className="h-4 w-4" />
        </FmtBtn>
        <FmtBtn
          label="취소선"
          active={editor.isActive("strike")}
          onClick={() => {
            editor.chain().focus().toggleStrike().run();
            dirty();
          }}
        >
          <Strikethrough className="h-4 w-4" />
        </FmtBtn>
        <FmtBtn
          label="인라인 코드"
          active={editor.isActive("code")}
          onClick={() => {
            editor.chain().focus().toggleCode().run();
            dirty();
          }}
        >
          <Code2 className="h-4 w-4" />
        </FmtBtn>

        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />

        {/* 링크 */}
        <div ref={linkRef} className="relative">
          <FmtBtn
            label="링크"
            active={editor.isActive("link") || linkOpen}
            onClick={() => {
              setTurnOpen(false);
              const prev = editor.getAttributes("link").href as
                | string
                | undefined;
              setLinkUrl(prev ?? "https://");
              setLinkOpen((v) => !v);
            }}
          >
            <Link2 className="h-4 w-4" />
          </FmtBtn>
          {linkOpen && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-[60] flex w-72 items-center gap-1 rounded-xl border border-border bg-card p-2 shadow-2xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                className="h-8 min-w-0 flex-1 rounded-md border border-border bg-input px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={linkUrl}
                placeholder="https://"
                autoFocus
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const href = linkUrl.trim();
                    if (href) {
                      editor
                        .chain()
                        .focus()
                        .extendMarkRange("link")
                        .setLink({ href })
                        .run();
                    }
                    dirty();
                    setLinkOpen(false);
                  }
                  if (e.key === "Escape") setLinkOpen(false);
                }}
              />
              <button
                type="button"
                className="h-8 shrink-0 rounded-md bg-indigo-600 px-2.5 text-xs font-medium text-white hover:bg-indigo-500"
                onClick={() => {
                  const href = linkUrl.trim();
                  if (href) {
                    editor
                      .chain()
                      .focus()
                      .extendMarkRange("link")
                      .setLink({ href })
                      .run();
                  }
                  dirty();
                  setLinkOpen(false);
                }}
              >
                적용
              </button>
              {editor.isActive("link") && (
                <button
                  type="button"
                  className="h-8 shrink-0 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .extendMarkRange("link")
                      .unsetLink()
                      .run();
                    dirty();
                    setLinkOpen(false);
                  }}
                >
                  제거
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </BubbleMenu>
  );
}

function FmtBtn({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-indigo-600/15 text-indigo-700 dark:text-indigo-300"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
