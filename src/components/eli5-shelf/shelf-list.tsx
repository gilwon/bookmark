"use client";
// eli5 설명서를 검색·분류해 카드로 보여주고 모달 안 iframe으로 문서를 연다.
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { filterEli5Shelf, type Eli5ShelfItem } from "@/lib/eli5-shelf";

export function ShelfList({ items }: { items: Eli5ShelfItem[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [tag, setTag] = useState("");
  const [active, setActive] = useState<Eli5ShelfItem | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const tags = [...new Set(items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, "ko"));
  const filtered = useMemo(() => filterEli5Shelf(items, { query, kind, tag }), [items, query, kind, tag]);
  const selectClass = "h-11 min-w-0 w-full rounded-md border border-border bg-input px-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  // 열릴 때 네이티브 dialog를 모달로 띄우고 포커스를 패널로 옮긴다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !active) return;
    if (!dialog.open) dialog.showModal();
    dialog.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  function open(item: Eli5ShelfItem, trigger: HTMLElement) {
    returnRef.current = trigger;
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setActive(item);
  }

  // 닫힌 뒤 포커스를 눌렀던 카드로 돌려준다.
  function close() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setActive(null);
    returnRef.current?.focus();
  }

  function resetFilters() {
    setQuery("");
    setKind("");
    setTag("");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_1fr_1fr]">
        <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
          <span>검색</span>
          <Input
            type="search"
            aria-label="설명서 검색"
            placeholder="제목·레포·설명·태그 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11"
          />
        </label>
        <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
          <span>종류</span>
          <select aria-label="종류 필터" value={kind} onChange={(event) => setKind(event.target.value)} className={selectClass}>
            <option value="">전체</option>
            <option value="설명">설명</option>
            <option value="비교">비교</option>
          </select>
        </label>
        <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
          <span>태그</span>
          <select aria-label="태그 필터" value={tag} onChange={(event) => setTag(event.target.value)} className={selectClass}>
            <option value="">전체 태그</option>
            {tags.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" role="status" className="text-sm text-muted-foreground">
          전체 {items.length}개 중 {filtered.length}개의 설명서
        </p>
        <Button type="button" variant="ghost" onClick={resetFilters} className="h-11 shrink-0">필터 초기화</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="일치하는 설명서가 없습니다."
          description="검색어나 필터를 바꿔보세요."
          action={<Button type="button" variant="outline" onClick={resetFilters} className="h-11">필터 초기화</Button>}
          className="my-8"
        />
      ) : (
        <ul className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="설명서 목록">
          {filtered.map((item) => (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                onClick={(event) => open(item, event.currentTarget)}
                className="block h-full w-full rounded-doc-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full transition-colors hover:border-indigo-500/40 active:border-indigo-500/60">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge>{item.kind}</Badge>
                      <time dateTime={item.date} className="text-[11px] leading-5 text-muted-foreground">{item.date}</time>
                    </div>
                    <span className="block break-words text-sm font-semibold leading-snug">{item.title}</span>
                    <span className="line-clamp-3 block text-sm text-muted-foreground">{item.summary}</span>
                    {item.tags.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {item.tags.map((name) => (
                          <Badge key={name} variant="outline">{name}</Badge>
                        ))}
                      </span>
                    )}
                    <span className="mt-auto break-all text-xs text-muted-foreground">{item.repo}</span>
                  </CardContent>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eli5-shelf-title"
        tabIndex={-1}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === dialogRef.current) close(); }}
        className="m-auto h-[92vh] w-[calc(100%-1rem)] max-w-5xl rounded-lg border border-border bg-background p-0 text-foreground shadow-[var(--shadow-popover)] backdrop:bg-black/45 sm:w-[calc(100%-2rem)]"
      >
        {active && (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 id="eli5-shelf-title" className="truncate text-sm font-semibold">{active.title}</h2>
                {/^https:\/\//.test(active.repoUrl) ? (
                <a
                  href={active.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-8 items-center break-all text-xs text-muted-foreground underline underline-offset-4 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-indigo-400"
                >
                  {active.repo} ↗
                </a>
                ) : (
                  <span className="block break-all text-xs text-muted-foreground">{active.repo}</span>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              key={active.id}
              title={`${active.title} 설명서`}
              src={`/eli5-shelf/${active.id}/doc?theme=${theme}`}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
              className="min-h-0 w-full flex-1 rounded-b-lg border-0 bg-background"
            />
          </div>
        )}
      </dialog>
    </div>
  );
}
