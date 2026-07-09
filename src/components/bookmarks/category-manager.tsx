// 북마크 카테고리 추가·수정·삭제
"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  categories: Category[];
};

/** 카테고리 마스터 CRUD UI */
export function CategoryManager({ categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      setError("이름을 입력하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "추가 실패");
      }
      setNewName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    const name = editName.trim();
    if (!name) {
      setError("이름을 입력하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "수정 실패");
      }
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cat: Category) {
    const msg =
      cat.count > 0
        ? `「${cat.name}」을(를) 삭제할까요?\n이 카테고리의 북마크 ${cat.count}개는 미분류로 바뀝니다.`
        : `「${cat.name}」을(를) 삭제할까요?`;
    if (!confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "삭제 실패");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
      >
        <span>카테고리 관리</span>
        <span className="text-xs text-muted-foreground">
          {categories.length}개 {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 카테고리 이름"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleAdd()}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              추가
            </Button>
          </div>

          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              등록된 카테고리가 없습니다. 위에서 추가하거나 북마크에 지정하면
              나타납니다.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2"
                >
                  {editingId === c.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 min-w-0 flex-1"
                        disabled={busy}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleRename(c.id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-emerald-600"
                        disabled={busy}
                        onClick={() => void handleRename(c.id)}
                        aria-label="저장"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={busy}
                        onClick={() => setEditingId(null)}
                        aria-label="취소"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {c.name}
                      </span>
                      <span
                        className={cn(
                          "tabular-nums text-xs text-muted-foreground"
                        )}
                      >
                        {c.count}개
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                          setError(null);
                        }}
                        aria-label="수정"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-400"
                        disabled={busy}
                        onClick={() => void handleDelete(c)}
                        aria-label="삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
