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
  PenLine,
  Search,
  Sparkles,
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
import { mergePaletteItems } from "@/lib/command-palette-results";
import type { QuickSearchItem, QuickSearchType } from "@/lib/quick-search";
import { cn } from "@/lib/utils";

const SEARCH_TYPE_ICON: Record<QuickSearchType, typeof Search> = {
  page: FileText,
  copy: PenLine,
  prompt: MessageSquareText,
  bookmark: Bookmark,
  star: GitFork,
  "agent-doc": Bot,
};

/** 팔레트에 표시되는 개별 액션 */
type CommandItem = {
  id: string;
  label: string;
  /** 필터용 추가 키워드 */
  keywords?: string;
  icon: ReactNode;
  /** 실행 시 동작. async 가능 */
  run: () => void | Promise<void>;
  disabled?: boolean;
  subtitle?: string;
  typeLabel?: string;
};

/** 비활성(로딩) 행을 건너뛰며 화살표 이동 */
function nextEnabledIndex(
  items: { disabled?: boolean }[],
  from: number,
  dir: 1 | -1
): number {
  const n = items.length;
  if (n === 0) return 0;
  let i = from;
  for (let step = 0; step < n; step++) {
    i = (i + dir + n) % n;
    if (!items[i]?.disabled) return i;
  }
  return from;
}

/** ⌘/Ctrl+K 로 여는 전역 검색·액션 팔레트 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [searchItems, setSearchItems] = useState<QuickSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** 입력·검색 결과 초기화 */
  const resetPalette = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setSearchItems([]);
    setSearchLoading(false);
    abortRef.current?.abort();
  }, []);

  /** 팔레트 닫기 + 입력 초기화 */
  const close = useCallback(() => {
    setOpen(false);
    resetPalette();
  }, [resetPalette]);

  /** 검색 결과 열기 — 외부 링크는 새 탭 */
  const openSearchItem = useCallback(
    (item: QuickSearchItem) => {
      close();
      if (
        (item.type === "bookmark" || item.type === "star") &&
        item.external
      ) {
        window.open(item.href, "_blank", "noopener");
        return;
      }
      router.push(item.href);
    },
    [close, router]
  );

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
        id: "nav-copies",
        label: "카피",
        keywords: "copies copy 카피 스레드",
        icon: <PenLine className="h-4 w-4" />,
        run: go("/copies"),
      },
      {
        id: "nav-prompts",
        label: "프롬프트",
        keywords: "prompt 프롬프트",
        icon: <MessageSquareText className="h-4 w-4" />,
        run: go("/prompts"),
      },
      {
        id: "nav-claude-prompts",
        label: "Claude Prompts",
        keywords: "claude prompts 클로드 프롬프트 300 우주보스",
        icon: <Sparkles className="h-4 w-4" />,
        run: go("/claude-prompts"),
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

  /** 통합검색 액션 + API 결과 + 필터된 내비 */
  const items = useMemo((): CommandItem[] => {
    const q = query.trim();
    const merged = mergePaletteItems({
      navItems: baseItems,
      searchItems,
      q,
      loading: searchLoading,
    });
    const navById = new Map(baseItems.map((item) => [item.id, item]));

    return merged.map((row) => {
      if (row.kind === "search-action") {
        return {
          id: row.id,
          label: row.label,
          icon: <Search className="h-4 w-4" />,
          run: () => {
            close();
            router.push(`/search?q=${encodeURIComponent(q)}`);
          },
        };
      }
      if (row.kind === "search") {
        const Icon = SEARCH_TYPE_ICON[row.item.type];
        return {
          id: row.id,
          label: row.label,
          subtitle: row.subtitle,
          typeLabel: row.typeLabel,
          icon: <Icon className="h-4 w-4" />,
          run: () => openSearchItem(row.item),
        };
      }
      if (row.kind === "loading") {
        return {
          id: row.id,
          label: row.label,
          icon: <Search className="h-4 w-4" />,
          disabled: true,
          run: () => {},
        };
      }
      return (
        navById.get(row.id) ?? {
          id: row.id,
          label: row.label,
          icon: <Search className="h-4 w-4" />,
          run: () => {},
        }
      );
    });
  }, [
    baseItems,
    close,
    openSearchItem,
    query,
    router,
    searchItems,
    searchLoading,
  ]);

  // 2글자 이상이면 디바운스 후 빠른 검색
  useEffect(() => {
    if (!open) {
      setSearchItems([]);
      setSearchLoading(false);
      abortRef.current?.abort();
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setSearchItems([]);
      setSearchLoading(false);
      abortRef.current?.abort();
      return;
    }

    setSearchLoading(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=8`,
          { signal: ac.signal }
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { items: QuickSearchItem[] };
        setSearchItems(data.items ?? []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSearchItems([]);
      } finally {
        if (!ac.signal.aborted) setSearchLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [open, query]);

  // 결과 목록이 바뀌면 선택 인덱스 보정
  useEffect(() => {
    setActiveIndex((i) => {
      if (items.length === 0) return 0;
      const clamped = Math.min(i, items.length - 1);
      if (!items[clamped]?.disabled) return clamped;
      const enabled = items.findIndex((item) => !item.disabled);
      return enabled === -1 ? clamped : enabled;
    });
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
            resetPalette();
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
  }, [createPage, resetPalette]);

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
      setActiveIndex((i) => nextEnabledIndex(items, i, 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      setActiveIndex((i) => nextEnabledIndex(items, i, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item && !item.disabled) void item.run();
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

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--glass-border)] glass-strong shadow-2xl">
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
                aria-selected={index === activeIndex && !item.disabled}
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                data-index={index}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  item.disabled
                    ? "cursor-default text-muted-foreground"
                    : index === activeIndex
                      ? "bg-indigo-600/20 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onMouseEnter={() => {
                  if (!item.disabled) setActiveIndex(index);
                }}
                onClick={() => {
                  if (!item.disabled) void item.run();
                }}
              >
                <span className="shrink-0 opacity-80">{item.icon}</span>
                {item.typeLabel ? (
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {item.typeLabel}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.subtitle ? (
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
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
