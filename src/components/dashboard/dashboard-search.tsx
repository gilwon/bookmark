// 대시보드 상단 통합 검색 — 페이지·프롬프트·에이전트·북마크·Stars 바로 이동
"use client";

import {
  Bookmark,
  Bot,
  FileText,
  GitFork,
  Loader2,
  MessageSquareText,
  Search,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { QuickSearchItem, QuickSearchType } from "@/lib/quick-search";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  QuickSearchType,
  { label: string; icon: typeof Search; className: string }
> = {
  page: {
    label: "페이지",
    icon: FileText,
    className: "text-sky-600 dark:text-sky-400",
  },
  prompt: {
    label: "프롬프트",
    icon: MessageSquareText,
    className: "text-violet-600 dark:text-violet-400",
  },
  "agent-doc": {
    label: "에이전트",
    icon: Bot,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  bookmark: {
    label: "북마크",
    icon: Bookmark,
    className: "text-amber-600 dark:text-amber-400",
  },
  star: {
    label: "Stars",
    icon: GitFork,
    className: "text-indigo-600 dark:text-indigo-400",
  },
};

/** 대시보드 히어로 영역용 통합 검색창 */
export function DashboardSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<QuickSearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const goFullSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        router.push("/search");
        return;
      }
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    },
    [router]
  );

  const openItem = useCallback(
    (item: QuickSearchItem) => {
      setOpen(false);
      if (item.external) {
        window.open(item.href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(item.href);
    },
    [router]
  );

  // 디바운스 검색
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setItems([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=6`,
          { signal: ac.signal }
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { items: QuickSearchItem[] };
        setItems(data.items ?? []);
        setActiveIndex(0);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setItems([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    const showList = open && (items.length > 0 || loading || query.trim());

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key === "ArrowDown" && showList && items.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp" && showList && items.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showList && items[activeIndex]) {
        openItem(items[activeIndex]);
        return;
      }
      goFullSearch(query);
    }
  }

  const showDropdown =
    open && query.trim().length > 0 && (loading || items.length >= 0);

  return (
    <div ref={rootRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (items[activeIndex] && open) {
            openItem(items[activeIndex]);
          } else {
            goFullSearch(query);
          }
        }}
        className="relative"
        role="search"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="페이지 · 프롬프트 · 에이전트 · 북마크 · Stars 검색…"
          className={cn(
            "h-12 w-full rounded-xl border border-border bg-card pl-10 pr-24 text-sm text-foreground shadow-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50"
          )}
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showDropdown}
          aria-activedescendant={
            showDropdown && items[activeIndex]
              ? `${listId}-item-${activeIndex}`
              : undefined
          }
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            Enter
          </kbd>
        </div>
      </form>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          {loading && items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              검색 중…
            </p>
          ) : items.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-muted-foreground">
                바로 열 결과가 없습니다.
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                onClick={() => goFullSearch(query)}
              >
                「{query.trim()}」 통합 검색 페이지로 →
              </button>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {items.map((item, index) => {
                const meta = TYPE_META[item.type];
                const Icon = meta.icon;
                const active = index === activeIndex;
                return (
                  <li key={`${item.type}-${item.id}`} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-item-${index}`}
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        active
                          ? "bg-indigo-600/15 text-foreground"
                          : "text-foreground hover:bg-muted/70"
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openItem(item)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80",
                          meta.className
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {item.title}
                          </span>
                          {item.external && (
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="shrink-0 rounded bg-muted px-1.5 py-px font-medium">
                            {meta.label}
                          </span>
                          <span className="truncate">{item.subtitle}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border bg-muted px-1">↑↓</kbd>{" "}
              이동 ·{" "}
              <kbd className="rounded border border-border bg-muted px-1">↵</kbd>{" "}
              열기
            </span>
            <button
              type="button"
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              onClick={() => goFullSearch(query)}
            >
              전체 검색
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
