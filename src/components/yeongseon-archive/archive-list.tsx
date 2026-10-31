"use client";
// 신영선 자료 아카이브를 검색하고 출처·주제로 걸러 카드로 보여 준다.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  YEONGSEON_PAGE_SIZE,
  articleUrl,
  filterYeongseonArchive,
  listYeongseonArchive,
  sourceOptions,
  topicOptions,
  visibleCount,
  type YeongseonArchiveItem,
} from "@/lib/yeongseon-archive";

function readShown(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : YEONGSEON_PAGE_SIZE;
}

export function ArchiveList({ items }: { items?: YeongseonArchiveItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const source = searchParams.get("source") ?? "";
  const topic = searchParams.get("topic") ?? "";
  const shownParam = readShown(searchParams.get("shown"));
  const catalog = useMemo(() => items ?? listYeongseonArchive(), [items]);
  const [draft, setDraft] = useState(qParam);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusIndex = useRef<number | null>(null);
  const filterRef = useRef({ source, topic });
  filterRef.current = { source, topic };

  useEffect(() => {
    setDraft((current) => (current.trim().slice(0, 160) === qParam ? current : qParam));
  }, [qParam]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const filtered = useMemo(
    () => filterYeongseonArchive(catalog, { query: qParam, source, topic }),
    [catalog, qParam, source, topic]
  );
  const shown = visibleCount(filtered.length, shownParam);
  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - visible.length;
  const sources = useMemo(() => sourceOptions(catalog), [catalog]);
  const topics = useMemo(() => topicOptions(catalog, source, topic), [catalog, source, topic]);
  const hasFilter = Boolean(qParam.trim() || source || topic || draft.trim());

  useEffect(() => {
    const index = focusIndex.current;
    if (index == null) return;
    focusIndex.current = null;
    const link = listRef.current?.querySelectorAll("a")[index];
    link?.focus();
  }, [shown, qParam, source, topic]);

  function replaceQuery(next: { q?: string; source?: string; topic?: string; shown?: number }) {
    const params = new URLSearchParams();
    const q = (next.q ?? "").trim().slice(0, 160);
    if (q) params.set("q", q);
    if (next.source) params.set("source", next.source);
    if (next.topic) params.set("topic", next.topic);
    if ((next.shown ?? 0) > YEONGSEON_PAGE_SIZE) params.set("shown", String(next.shown));
    const qs = params.toString();
    router.replace(qs ? `/yeongseon-archive?${qs}` : "/yeongseon-archive", { scroll: false });
  }

  function commitQuery(value: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const current = filterRef.current;
    replaceQuery({ q: value, source: current.source, topic: current.topic, shown: YEONGSEON_PAGE_SIZE });
  }

  function onDraftChange(value: string) {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commitQuery(value), 150);
  }

  function selectSource(name: string) {
    replaceQuery({
      q: qParam,
      source: name,
      topic: name === source ? topic : "",
      shown: YEONGSEON_PAGE_SIZE,
    });
  }

  function selectTopic(name: string) {
    replaceQuery({ q: qParam, source, topic: name, shown: YEONGSEON_PAGE_SIZE });
  }

  function loadMore() {
    focusIndex.current = visible.length;
    replaceQuery({ q: qParam, source, topic, shown: shown + YEONGSEON_PAGE_SIZE });
  }

  function resetFilters() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setDraft("");
    replaceQuery({ q: "", source: "", topic: "", shown: YEONGSEON_PAGE_SIZE });
    inputRef.current?.focus();
  }

  const resetButton = (
    <Button type="button" variant="outline" onClick={resetFilters} className="h-11 min-h-11">
      검색·필터 초기화
    </Button>
  );

  return (
    <div className="space-y-4">
      <label className="block min-w-0 space-y-1.5 text-xs text-muted-foreground">
        <span>검색</span>
        <Input
          ref={inputRef}
          type="search"
          aria-label="자료 검색"
          placeholder="예: 클로드, 영상, 프롬프트"
          maxLength={160}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commitQuery(draft);
          }}
          className="h-11 min-h-11"
        />
      </label>

      <div className="flex flex-wrap gap-2" role="group" aria-label="출처">
        {sources.map((option) => (
          <Button
            key={`source:${option.name}`}
            type="button"
            variant={source === option.name ? "secondary" : "outline"}
            aria-pressed={source === option.name}
            onClick={() => selectSource(option.name)}
            className="h-11 min-h-11"
          >
            {option.name === "" ? `전체 ${option.count}` : `${option.name} ${option.count}`}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="주제">
        {topics.map((option) => (
          <Button
            key={`topic:${option.name}`}
            type="button"
            variant={topic === option.name ? "secondary" : "outline"}
            aria-pressed={topic === option.name}
            onClick={() => selectTopic(option.name)}
            className="h-11 min-h-11"
          >
            {option.name === "" ? `전체 ${option.count}` : `${option.name} ${option.count}`}
          </Button>
        ))}
      </div>

      <p aria-live="polite" role="status" className="text-sm text-muted-foreground">
        {filtered.length === 0 ? "검색 결과 0편" : `${filtered.length}편 중 ${visible.length}편 보는 중`}
      </p>

      {hasFilter && filtered.length > 0 ? resetButton : null}

      {filtered.length === 0 ? (
        <EmptyState
          title="검색 결과가 없습니다."
          description="다른 검색어를 입력하거나 검색·필터를 초기화해 주세요."
          action={resetButton}
          className="my-8"
        />
      ) : (
        <ul ref={listRef} className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="자료 목록">
          {visible.map((item) => (
            <li key={item.id} className="min-w-0">
              <a
                href={articleUrl(item.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full rounded-doc-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full transition-colors hover:border-indigo-500/40 active:border-indigo-500/60">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <Badge variant="secondary">{`${item.publishedAt} · ${item.source} · ${item.level}`}</Badge>
                    <h2 className="break-words text-sm font-semibold leading-snug">{item.title}</h2>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{item.tags.join(" · ")}</p>
                  </CardContent>
                </Card>
              </a>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <Button type="button" variant="outline" onClick={loadMore} className="h-11 min-h-11">
          {`더 보기 (${remaining}편 남음)`}
        </Button>
      ) : null}
    </div>
  );
}
