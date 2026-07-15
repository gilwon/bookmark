// 커스텀 페이지 목록 + 검색·정렬·페이징 + 생성·선택 삭제
"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CustomPage } from "@/lib/types";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import {
  compareIsoDesc,
  compareTitleAsc,
  DEFAULT_PAGE_SIZE,
  formatListDate,
  type ListSortKey,
  matchesSearchTokens,
  slicePage,
} from "@/lib/list-utils";
import { PdfImportForm } from "@/components/pages/pdf-import-form";
import { UrlImportForm } from "@/components/pages/url-import-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  SearchSuggestInput,
  type SearchSuggestItem,
} from "@/components/ui/search-suggest-input";
import { Select } from "@/components/ui/select";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: ListSortKey; label: string }[] = [
  { value: "created_desc", label: "등록일 최신" },
  { value: "updated_desc", label: "수정일 최신" },
  { value: "title_asc", label: "제목 가나다" },
];

function sortPages(list: CustomPage[], sort: ListSortKey): CustomPage[] {
  const arr = [...list];
  if (sort === "title_asc") {
    arr.sort((a, b) => compareTitleAsc(a.title, b.title));
  } else if (sort === "updated_desc") {
    arr.sort((a, b) => compareIsoDesc(a.updatedAt, b.updatedAt));
  } else {
    arr.sort((a, b) => compareIsoDesc(a.createdAt, b.createdAt));
  }
  return arr;
}

/** 페이지 목록을 렌더하고 검색/정렬/페이징/생성/삭제를 처리한다. */
export function PageList({ pages }: { pages: CustomPage[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ListSortKey>("created_desc");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const matched = pages.filter((p) =>
      matchesSearchTokens(p.title ?? "", q)
    );
    return sortPages(matched, sort);
  }, [pages, q, sort]);

  useEffect(() => {
    setPage(1);
  }, [q, sort]);

  const pageItems = useMemo(
    () => slicePage(filtered, page, DEFAULT_PAGE_SIZE),
    [filtered, page]
  );

  /** 검색 suggest — 페이지 제목 */
  const searchSuggestions = useMemo((): SearchSuggestItem[] => {
    return pages
      .map((p) => p.title?.trim())
      .filter((t): t is string => Boolean(t))
      .map((title) => ({ value: title, label: title, group: "제목" }));
  }, [pages]);

  const ids = useMemo(() => pageItems.map((p) => p.id), [pageItems]);
  const selection = useSelection(ids);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "제목 없는 페이지" }),
      });
      if (!res.ok) throw new Error("생성 실패");
      const created = await res.json();
      router.push(`/pages/${created.id}`);
      router.refresh();
    } catch {
      alert("페이지 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 페이지를 삭제할까요?")) return;
    const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (
      !confirm(`선택한 페이지 ${selection.selectedCount}개를 삭제할까요?`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/pages/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => void handleCreate()} disabled={creating}>
          <Plus className="h-4 w-4" />
          {creating ? "생성 중…" : "새 페이지"}
        </Button>
      </div>

      <UrlImportForm />
      <PdfImportForm />

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          아직 페이지가 없습니다. 새 페이지를 만들어 보세요.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">
                검색 (제목 · 공백으로 여러 단어 AND)
              </label>
              <SearchSuggestInput
                placeholder="예: Muse 총정리 · Claude 폴더"
                value={q}
                onChange={setQ}
                suggestions={searchSuggestions}
              />
            </div>
            <div className="w-full space-y-1 sm:w-44">
              <label
                htmlFor="page-sort"
                className="text-xs text-muted-foreground"
              >
                정렬
              </label>
              <Select
                id="page-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as ListSortKey)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            전체 {pages.length}개 · 검색 결과 {filtered.length}개
            {q.trim() ? " · 본문 검색은 상단 통합 검색 활용" : ""}
          </p>

          <SelectionToolbar
            total={pageItems.length}
            selectedCount={selection.selectedCount}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            deleting={deleting}
            onToggleAll={selection.toggleAll}
            onDeleteSelected={() => void deleteSelected()}
          />

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              검색 조건에 맞는 페이지가 없습니다.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {pageItems.map((p) => {
                  const selected = selection.isSelected(p.id);
                  return (
                    <Card
                      key={p.id}
                      className={cn(
                        "group transition-colors hover:border-border",
                        selected &&
                          "border-indigo-500 ring-1 ring-indigo-500/40"
                      )}
                    >
                      <CardContent className="flex items-center gap-3 p-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-indigo-600"
                          checked={selected}
                          onChange={() => selection.toggle(p.id)}
                          aria-label={`${p.title} 선택`}
                        />
                        <FileText className="h-5 w-5 shrink-0 text-indigo-400" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/pages/${p.id}`}
                            className="block truncate font-medium hover:text-indigo-300"
                          >
                            {p.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            등록 {formatListDate(p.createdAt)}
                            {p.updatedAt !== p.createdAt
                              ? ` · 수정 ${formatListDate(p.updatedAt)}`
                              : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 text-red-400"
                          onClick={() => void handleDelete(p.id)}
                          aria-label="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <ListPagination
                page={page}
                total={filtered.length}
                pageSize={DEFAULT_PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
