// 프롬프트 라이브러리 목록 — 목차 그룹·검색·카테고리 칩·선택 삭제
"use client";

import { Copy, MessageSquareText, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Prompt } from "@/lib/types";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SearchSuggestInput,
  type SearchSuggestItem,
} from "@/components/ui/search-suggest-input";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const UNCATEGORIZED = "미분류";
const FAVORITES = "⭐ 즐겨찾기";

/** 목차 라벨 정규화 (빈 값 → 미분류) */
function categoryLabel(p: Prompt): string {
  return p.category?.trim() || UNCATEGORIZED;
}

/**
 * 목차 정렬: "1-1.", "2-10." 숫자 자연순. 미분류는 맨 뒤.
 */
function compareCategory(a: string, b: string): number {
  if (a === UNCATEGORIZED && b !== UNCATEGORIZED) return 1;
  if (b === UNCATEGORIZED && a !== UNCATEGORIZED) return -1;
  return a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" });
}

/** 즐겨찾기 우선 → 목차 → 제목 */
function comparePrompt(a: Prompt, b: Prompt): number {
  if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
  const cat = compareCategory(categoryLabel(a), categoryLabel(b));
  if (cat !== 0) return cat;
  return a.title.localeCompare(b.title, "ko", {
    numeric: true,
    sensitivity: "base",
  });
}

/** 프롬프트 목록 UI */
export function PromptList({ prompts }: { prompts: Prompt[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState(ALL);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of prompts) {
      const c = categoryLabel(p);
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => compareCategory(a[0], b[0]))
      .map(([label, count]) => ({ label, count }));
  }, [prompts]);

  // 필터 후 목차 → 제목 순 정렬 (updatedAt 섞임 방지)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return prompts
      .filter((p) => {
        const cat = categoryLabel(p);
        if (activeCat !== ALL && cat !== activeCat) return false;
        if (!needle) return true;
        const hay = [
          p.title,
          p.category ?? "",
          p.summary ?? "",
          p.whenToUse ?? "",
          ...p.sections.flatMap((s) => [s.title, s.body]),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort(comparePrompt);
  }, [prompts, q, activeCat]);

  /**
   * 전체 보기: 즐겨찾기 섹션을 맨 위, 나머지는 목차별.
   * 목차 필터: 해당 목차만, 즐겨찾기 항목이 먼저.
   */
  const groups = useMemo(() => {
    if (activeCat === ALL) {
      const favs = filtered.filter((p) => p.isFavorite);
      const rest = filtered.filter((p) => !p.isFavorite);
      const map = new Map<string, Prompt[]>();
      for (const p of rest) {
        const c = categoryLabel(p);
        const list = map.get(c);
        if (list) list.push(p);
        else map.set(c, [p]);
      }
      const catGroups = [...map.entries()]
        .sort((a, b) => compareCategory(a[0], b[0]))
        .map(([label, items]) => ({ label, items, isFavoriteGroup: false }));
      if (favs.length > 0) {
        return [
          { label: FAVORITES, items: favs, isFavoriteGroup: true },
          ...catGroups,
        ];
      }
      return catGroups;
    }
    return [
      {
        label: activeCat,
        items: filtered,
        isFavoriteGroup: false,
      },
    ];
  }, [filtered, activeCat]);

  const suggestions = useMemo((): SearchSuggestItem[] => {
    const items: SearchSuggestItem[] = [];
    for (const p of prompts) {
      if (p.title.trim()) {
        items.push({ value: p.title, label: p.title, group: "제목" });
      }
      if (p.category?.trim()) {
        items.push({
          value: p.category.trim(),
          label: p.category.trim(),
          group: "목차",
        });
      }
    }
    return items;
  }, [prompts]);

  const ids = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const selection = useSelection(ids);

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (
      !confirm(`선택한 프롬프트 ${selection.selectedCount}개를 삭제할까요?`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/prompts/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  async function copyAll(p: Prompt) {
    const text = p.sections
      .map((s) => `## ${s.title}\n\n${s.body}`)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  /** 즐겨찾기 on/off */
  async function toggleFavorite(p: Prompt) {
    if (favoritingId) return;
    setFavoritingId(p.id);
    try {
      const res = await fetch(`/api/prompts/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !p.isFavorite }),
      });
      if (res.ok) router.refresh();
    } finally {
      setFavoritingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex-1 min-w-[200px] max-w-md space-y-1">
          <label className="text-xs text-muted-foreground">검색</label>
          <SearchSuggestInput
            placeholder="제목, 목차, 본문…"
            value={q}
            onChange={setQ}
            suggestions={suggestions}
          />
        </div>
        <Link
          href="/prompts/new"
          className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          새 프롬프트
        </Link>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCat(ALL)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeCat === ALL
                ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-700 dark:text-indigo-300"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            전체 ({prompts.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() =>
                setActiveCat((prev) => (prev === c.label ? ALL : c.label))
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeCat === c.label
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          등록된 프롬프트가 없습니다. 새 프롬프트를 만들어 보세요.
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          조건에 맞는 프롬프트가 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          <SelectionToolbar
            total={filtered.length}
            selectedCount={selection.selectedCount}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            deleting={deleting}
            onToggleAll={selection.toggleAll}
            onDeleteSelected={() => void deleteSelected()}
          />

          {/* 전체: 즐겨찾기 상단 + 목차 섹션 / 칩 선택: 해당 목차만 */}
          {groups.map((group) => {
            const showHeader =
              activeCat === ALL &&
              (groups.length > 1 || group.isFavoriteGroup);
            return (
              <section key={group.label} className="space-y-3">
                {showHeader && (
                  <div
                    className={cn(
                      "sticky top-0 z-10 -mx-1 flex items-center gap-2 border-b px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80",
                      group.isFavoriteGroup
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/60 bg-background/95"
                    )}
                  >
                    <h2
                      className={cn(
                        "text-sm font-semibold tracking-tight",
                        group.isFavoriteGroup
                          ? "text-amber-800 dark:text-amber-200"
                          : "text-foreground"
                      )}
                    >
                      {group.label}
                    </h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {group.items.length}
                    </span>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((p) => {
                    const selected = selection.isSelected(p.id);
                    const cat = categoryLabel(p);
                    // 즐겨찾기 섹션·목차 헤더가 있을 때 뱃지 정책
                    const showCatBadge =
                      (group.isFavoriteGroup || !showHeader) &&
                      cat !== UNCATEGORIZED;
                    return (
                      <Card
                        key={p.id}
                        className={cn(
                          "group transition-colors hover:border-border",
                          selected &&
                            "border-indigo-500 ring-1 ring-indigo-500/40",
                          p.isFavorite && "border-amber-500/40"
                        )}
                      >
                        <CardContent className="flex items-start gap-3 p-4">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                            checked={selected}
                            onChange={() => selection.toggle(p.id)}
                            aria-label={`${p.title} 선택`}
                          />
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-300">
                            <MessageSquareText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {showCatBadge && (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                              >
                                {cat}
                              </Badge>
                            )}
                            <Link
                              href={`/prompts/${p.id}`}
                              className="block font-medium leading-snug hover:text-indigo-500"
                            >
                              {p.title}
                            </Link>
                            {p.whenToUse && (
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {p.whenToUse}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground">
                              섹션 {p.sections.length}
                              {p.sections.length > 1 ? " (1·2차)" : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                p.isFavorite
                                  ? "text-amber-500"
                                  : "text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              )}
                              title={
                                p.isFavorite
                                  ? "즐겨찾기 해제"
                                  : "즐겨찾기"
                              }
                              aria-label={
                                p.isFavorite
                                  ? "즐겨찾기 해제"
                                  : "즐겨찾기"
                              }
                              aria-pressed={p.isFavorite}
                              disabled={favoritingId === p.id}
                              onClick={() => void toggleFavorite(p)}
                            >
                              <Star
                                className={cn(
                                  "h-4 w-4",
                                  p.isFavorite && "fill-current"
                                )}
                              />
                            </Button>
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="전체 복사"
                                aria-label="전체 복사"
                                onClick={() => void copyAll(p)}
                              >
                                <Copy
                                  className={cn(
                                    "h-4 w-4",
                                    copiedId === p.id && "text-emerald-500"
                                  )}
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400"
                                aria-label="삭제"
                                onClick={async () => {
                                  if (!confirm("이 프롬프트를 삭제할까요?"))
                                    return;
                                  const res = await fetch(
                                    `/api/prompts/${p.id}`,
                                    { method: "DELETE" }
                                  );
                                  if (res.ok) router.refresh();
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
