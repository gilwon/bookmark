// ⌘K 전역 커맨드 팔레트 — 네비 이동·빠른 액션·통합 검색 진입
"use client";

import {
  Bot,
  FilePlus,
  FileText,
  GitFork,
  LayoutDashboard,
  Bookmark,
  MessageSquareText,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** 팔레트에 표시되는 개별 액션 */
type CommandItem = {
  id: string;
  label: string;
  /** 필터용 추가 키워드 */
  keywords?: string;
  icon: ReactNode;
  /** 실행 시 동작. async 가능 */
  run: () => void | Promise<void>;
};

/** ⌘/Ctrl+K 로 여는 전역 검색·액션 팔레트 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** 팔레트 닫기 + 입력 초기화 */
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  /** 새 페이지 생성 후 편집 화면으로 이동 */
  const createPage = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "제목 없는 페이지" }),
      });
      if (!res.ok) throw new Error("생성 실패");
      const page = (await res.json()) as { id: string };
      close();
      router.push(`/pages/${page.id}`);
      router.refresh();
    } catch {
      alert("페이지 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }, [close, creating, router]);

  /** 고정 네비·액션 목록 */
  const baseItems = useMemo((): CommandItem[] => {
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    return [
      {
        id: "nav-home",
        label: "홈",
        keywords: "dashboard 대시보드",
        icon: <LayoutDashboard className="h-4 w-4" />,
        run: go("/dashboard"),
      },
      {
        id: "nav-bookmarks",
        label: "북마크",
        keywords: "bookmarks",
        icon: <Bookmark className="h-4 w-4" />,
        run: go("/bookmarks"),
      },
      {
        id: "nav-stars",
        label: "GitHub Stars",
        keywords: "stars 스타",
        icon: <GitFork className="h-4 w-4" />,
        run: go("/stars"),
      },
      {
        id: "nav-pages",
        label: "페이지",
        keywords: "pages",
        icon: <FileText className="h-4 w-4" />,
        run: go("/pages"),
      },
      {
        id: "nav-prompts",
        label: "프롬프트",
        keywords: "prompt 프롬프트",
        icon: <MessageSquareText className="h-4 w-4" />,
        run: go("/prompts"),
      },
      {
        id: "nav-agent-docs",
        label: "에이전트 문서",
        keywords: "agent docs 문서",
        icon: <Bot className="h-4 w-4" />,
        run: go("/agent-docs"),
      },
      {
        id: "nav-search",
        label: "검색 페이지",
        keywords: "search 검색",
        icon: <Search className="h-4 w-4" />,
        run: go("/search"),
      },
      {
        id: "action-new-page",
        label: creating ? "페이지 생성 중…" : "새 페이지",
        keywords: "new page 만들기 생성",
        icon: <FilePlus className="h-4 w-4" />,
        run: () => void createPage(),
      },
    ];
  }, [close, createPage, creating, router]);

  /** 검색어로 필터 + 통합 검색 액션 추가 */
  const items = useMemo((): CommandItem[] => {
    const q = query.trim();
    const needle = q.toLowerCase();

    const filtered = needle
      ? baseItems.filter((item) => {
          const hay = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
          return hay.includes(needle);
        })
      : baseItems;

    if (!q) return filtered;

    const searchItem: CommandItem = {
      id: "action-search",
      label: `「${q}」통합 검색`,
      icon: <Search className="h-4 w-4" />,
      run: () => {
        close();
        router.push(`/search?q=${encodeURIComponent(q)}`);
      },
    };

    // 검색 액션을 맨 위에 두어 Enter 한 번으로 통합 검색 가능
    return [searchItem, ...filtered];
  }, [baseItems, close, query, router]);

  // 결과 목록이 바뀌면 선택 인덱스 보정
  useEffect(() => {
    setActiveIndex((i) =>
      items.length === 0 ? 0 : Math.min(i, items.length - 1)
    );
  }, [items]);

  // 활성 항목이 보이도록 스크롤
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // 열릴 때 입력 포커스
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // 전역 단축키: ⌘/Ctrl+K 토글, ⌘/Ctrl+N 새 페이지
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (v) {
            setQuery("");
            setActiveIndex(0);
            return false;
          }
          return true;
        });
        return;
      }
      if (key === "n") {
        // 입력 중이면 기본 동작 유지 (텍스트 입력 방해 방지)
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (e.target as HTMLElement | null)?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        void createPage();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createPage]);

  /** 팔레트 내부 키보드 네비 */
  function handlePaletteKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      setActiveIndex((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) void item.run();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] sm:pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="커맨드 팔레트"
      onKeyDown={handlePaletteKeyDown}
    >
      {/* 오버레이 클릭 시 닫기 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
        onClick={close}
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="페이지 이동, 액션 검색…"
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-72 overflow-y-auto p-1.5"
          role="listbox"
        >
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              결과가 없습니다
            </p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                data-index={index}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  index === activeIndex
                    ? "bg-indigo-600/20 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void item.run()}
              >
                <span className="shrink-0 opacity-80">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-muted px-1">↑↓</kbd>{" "}
            이동
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1">↵</kbd>{" "}
            실행
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1">esc</kbd>{" "}
            닫기
          </span>
        </div>
      </div>
    </div>
  );
}
