// 커스텀 페이지 목록 + 검색 + 생성 + 전체 선택 / 선택 삭제
"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CustomPage } from "@/lib/types";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import { extractTiptapText } from "@/lib/tiptap-text";
import { UrlImportForm } from "@/components/pages/url-import-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { cn } from "@/lib/utils";

/** 페이지 목록을 렌더하고 검색/생성/삭제/선택 삭제를 처리한다. */
export function PageList({ pages }: { pages: CustomPage[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return pages;
    return pages.filter((p) => {
      const hay = [p.title, extractTiptapText(p.content)]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [pages, q]);

  const ids = useMemo(() => filtered.map((p) => p.id), [filtered]);
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
      const page = await res.json();
      router.push(`/pages/${page.id}`);
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

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          아직 페이지가 없습니다. 새 페이지를 만들어 보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Stars 와 동일한 검색 입력 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">검색</label>
              <Input
                placeholder="제목, 본문…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <SelectionToolbar
            total={filtered.length}
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
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((page) => {
                const selected = selection.isSelected(page.id);
                return (
                  <Card
                    key={page.id}
                    className={cn(
                      "group transition-colors hover:border-border",
                      selected && "border-indigo-500 ring-1 ring-indigo-500/40"
                    )}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-indigo-600"
                        checked={selected}
                        onChange={() => selection.toggle(page.id)}
                        aria-label={`${page.title} 선택`}
                      />
                      <FileText className="h-5 w-5 shrink-0 text-indigo-400" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/pages/${page.id}`}
                          className="block truncate font-medium hover:text-indigo-300"
                        >
                          {page.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          수정{" "}
                          {new Date(page.updatedAt).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 text-red-400"
                        onClick={() => void handleDelete(page.id)}
                        aria-label="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
