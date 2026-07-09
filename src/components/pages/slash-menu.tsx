// 노션형 `/` 슬래시 메뉴
"use client";

import type { Editor } from "@tiptap/react";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  MessageSquareWarning,
  Minus,
  Bookmark,
  Quote,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SlashCommandId =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "ordered"
  | "task"
  | "quote"
  | "callout"
  | "code"
  | "image"
  | "hr"
  | "embed";

type SlashItem = {
  id: SlashCommandId;
  title: string;
  desc: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ITEMS: SlashItem[] = [
  {
    id: "text",
    title: "텍스트",
    desc: "일반 텍스트로 쓰기",
    keywords: "text paragraph 본문 텍스트 일반",
    icon: Type,
  },
  {
    id: "h1",
    title: "제목1",
    desc: "큰 섹션 제목",
    keywords: "h1 heading title 제목1",
    icon: Heading1,
  },
  {
    id: "h2",
    title: "제목2",
    desc: "중간 섹션 제목",
    keywords: "h2 heading 제목2",
    icon: Heading2,
  },
  {
    id: "h3",
    title: "제목3",
    desc: "작은 섹션 제목",
    keywords: "h3 heading 제목3",
    icon: Heading3,
  },
  {
    id: "bullet",
    title: "글머리 기호 목록",
    desc: "간단한 글머리 기호 목록",
    keywords: "bullet list ul 목록 글머리",
    icon: List,
  },
  {
    id: "ordered",
    title: "번호 매기기 목록",
    desc: "번호가 매겨진 목록",
    keywords: "ordered list ol 번호 매기기",
    icon: ListOrdered,
  },
  {
    id: "task",
    title: "할 일 목록",
    desc: "체크박스가 있는 할 일",
    keywords: "todo task checklist 할일 할 일 체크",
    icon: ListChecks,
  },
  {
    id: "quote",
    title: "인용",
    desc: "인용문을 담은 블록",
    keywords: "quote blockquote 인용",
    icon: Quote,
  },
  {
    id: "callout",
    title: "콜아웃",
    desc: "강조 박스 (aside)",
    keywords: "callout aside 콜아웃 강조",
    icon: MessageSquareWarning,
  },
  {
    id: "code",
    title: "코드",
    desc: "코드 스니펫 블록",
    keywords: "code codeblock 코드",
    icon: Code2,
  },
  {
    id: "image",
    title: "이미지",
    desc: "URL로 이미지 삽입",
    keywords: "image img picture 이미지 사진",
    icon: ImageIcon,
  },
  {
    id: "hr",
    title: "구분선",
    desc: "콘텐츠를 시각적으로 구분",
    keywords: "hr divider 구분선",
    icon: Minus,
  },
  {
    id: "embed",
    title: "임베드",
    desc: "북마크 · GitHub Star 삽입",
    keywords: "embed bookmark star 임베드 북마크",
    icon: Bookmark,
  },
];

type Props = {
  editor: Editor | null;
  onRequestEmbed: () => void;
  onRanCommand?: () => void;
};

type MenuState = {
  open: boolean;
  query: string;
  /** 슬래시 시작 문서 위치 */
  from: number;
  top: number;
  left: number;
};

/** `/` 입력 시 블록 변환 메뉴 */
export function SlashMenu({ editor, onRequestEmbed, onRanCommand }: Props) {
  const [menu, setMenu] = useState<MenuState>({
    open: false,
    query: "",
    from: 0,
    top: 0,
    left: 0,
  });
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = menu.query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.desc.toLowerCase().includes(q) ||
        it.keywords.toLowerCase().includes(q)
    );
  }, [menu.query]);

  useEffect(() => {
    setActive(0);
  }, [menu.query, menu.open]);

  const close = useCallback(() => {
    setMenu((m) => ({ ...m, open: false, query: "" }));
  }, []);

  const run = useCallback(
    (id: SlashCommandId) => {
      if (!editor) return;
      const { from } = menu;
      const to = editor.state.selection.from;
      // 슬래시 + 검색어 삭제
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .run();

      switch (id) {
        case "text":
          editor.chain().focus().setParagraph().run();
          break;
        case "h1":
          editor.chain().focus().setHeading({ level: 1 }).run();
          break;
        case "h2":
          editor.chain().focus().setHeading({ level: 2 }).run();
          break;
        case "h3":
          editor.chain().focus().setHeading({ level: 3 }).run();
          break;
        case "bullet":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "ordered":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "task":
          editor.chain().focus().toggleTaskList().run();
          break;
        case "quote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "callout":
          editor.chain().focus().insertCallout().run();
          break;
        case "code":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "image": {
          // 간단한 URL 프롬프트로 이미지 삽입
          const url = window.prompt("이미지 URL을 입력하세요");
          if (url?.trim()) {
            editor
              .chain()
              .focus()
              .setImage({ src: url.trim() })
              .run();
          }
          break;
        }
        case "hr":
          editor.chain().focus().setHorizontalRule().run();
          break;
        case "embed":
          onRequestEmbed();
          break;
      }
      onRanCommand?.();
      close();
    },
    [editor, menu, close, onRequestEmbed, onRanCommand]
  );

  // 에디터 업데이트로 슬래시 감지
  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const { selection, doc } = editor.state;
      if (!selection.empty) {
        close();
        return;
      }
      const pos = selection.from;
      const $from = selection.$from;
      // 현재 텍스트 블록 시작~커서
      const blockStart = $from.start();
      const textBefore = doc.textBetween(blockStart, pos, "\n", "\0");
      // 줄 끝의 /query 패턴
      const m = /(?:^|\s)\/([^\s]*)$/.exec(textBefore);
      if (!m) {
        if (menu.open) close();
        return;
      }
      const query = m[1] ?? "";
      const slashIndex = textBefore.lastIndexOf("/" + query);
      const from = blockStart + slashIndex;

      // 좌표
      try {
        const coords = editor.view.coordsAtPos(pos);
        const editorRect = editor.view.dom.getBoundingClientRect();
        setMenu({
          open: true,
          query,
          from,
          top: coords.bottom - editorRect.top + 6,
          left: Math.max(0, coords.left - editorRect.left),
        });
      } catch {
        close();
      }
    };

    editor.on("selectionUpdate", update);
    editor.on("update", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor, close, menu.open]);

  // 키보드 탐색
  useEffect(() => {
    if (!editor || !menu.open) return;

    const onKey = (e: KeyboardEvent) => {
      if (!menu.open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActive((i) => (i + 1) % Math.max(filtered.length, 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActive(
          (i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1)
        );
        return;
      }
      if (e.key === "Enter") {
        if (filtered[active]) {
          e.preventDefault();
          e.stopPropagation();
          run(filtered[active]!.id);
        }
      }
    };

    // capture 로 에디터보다 먼저
    const el = editor.view.dom;
    el.addEventListener("keydown", onKey, true);
    return () => el.removeEventListener("keydown", onKey, true);
  }, [editor, menu.open, filtered, active, run, close]);

  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-idx="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!menu.open || !editor) return null;

  return (
    <div
      className="slash-menu absolute z-40 w-[min(100%,17rem)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      style={{ top: menu.top, left: menu.left }}
      role="listbox"
      aria-label="슬래시 명령"
    >
      <div className="border-b border-border px-3 py-2 text-[11px] font-medium text-muted-foreground">
        기본 블록
        {menu.query ? (
          <span className="ml-1 font-normal text-foreground">
            · /{menu.query}
          </span>
        ) : null}
      </div>
      <div ref={listRef} className="max-h-80 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            결과 없음
          </p>
        ) : (
          filtered.map((it, idx) => {
            const Icon = it.icon;
            return (
              <button
                key={it.id}
                type="button"
                data-idx={idx}
                role="option"
                aria-selected={idx === active}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                  idx === active
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted/70"
                )}
                onMouseEnter={() => setActive(idx)}
                onClick={() => run(it.id)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">
                    {it.title}
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {it.desc}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        ↑↓ 이동 · Enter 선택 · Esc 닫기
      </div>
    </div>
  );
}

/** 블록 핸들의 + 로 슬래시 메뉴를 열 때 사용: 현재 위치에 `/` 삽입 */
export function insertSlashTrigger(editor: Editor) {
  editor.chain().focus().insertContent("/").run();
}
