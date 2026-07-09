// 프롬프트 라이브러리 목록 — 검색·카테고리 칩·선택 삭제
"use client";

import { Copy, MessageSquareText, Plus, Trash2 } from "lucide-react";
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

/** 프롬프트 목록 UI */
export function PromptList({ prompts }: { prompts: Prompt[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState(ALL);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of prompts) {
      const c = p.category?.trim() || "미분류";
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ko"))
      .map(([label, count]) => ({ label, count }));
  }, [prompts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return prompts.filter((p) => {
      const cat = p.category?.trim() || "미분류";
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
    });
  }, [prompts, q, activeCat]);

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
        <div className="space-y-3">
          <SelectionToolbar
            total={filtered.length}
            selectedCount={selection.selectedCount}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            deleting={deleting}
            onToggleAll={selection.toggleAll}
            onDeleteSelected={() => void deleteSelected()}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((p) => {
              const selected = selection.isSelected(p.id);
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "group transition-colors hover:border-border",
                    selected && "border-indigo-500 ring-1 ring-indigo-500/40"
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
                      {p.category && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                        >
                          {p.category}
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
                        섹션 {p.sections.length} · 수정{" "}
                        {new Date(p.updatedAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100">
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
                          if (!confirm("이 프롬프트를 삭제할까요?")) return;
                          const res = await fetch(`/api/prompts/${p.id}`, {
                            method: "DELETE",
                          });
                          if (res.ok) router.refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
