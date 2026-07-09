// Stars 페이지 — 필터 + 동기화 + 변경 뱃지 + 선택 삭제
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GithubStar } from "@/lib/types";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import { StarCard } from "@/components/stars/star-card";
import { SyncButton } from "@/components/stars/sync-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";

type Props = {
  initialStars: GithubStar[];
  hasGithub: boolean;
  lastSynced: string | null;
  autoSyncOnEmpty: boolean;
};

/** Star 목록 UI + 변경 필터 + 확인 처리 */
export function StarsView({
  initialStars,
  hasGithub,
  lastSynced,
  autoSyncOnEmpty,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("all");
  const [changeFilter, setChangeFilter] = useState<
    "all" | "changed" | "new" | "updated"
  >("all");
  const [deleting, setDeleting] = useState(false);
  const [acking, setAcking] = useState(false);

  const changeCount = useMemo(
    () =>
      initialStars.filter(
        (s) => s.changeKind === "new" || s.changeKind === "updated"
      ).length,
    [initialStars]
  );
  const newCount = useMemo(
    () => initialStars.filter((s) => s.changeKind === "new").length,
    [initialStars]
  );
  const updatedCount = useMemo(
    () => initialStars.filter((s) => s.changeKind === "updated").length,
    [initialStars]
  );

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const s of initialStars) {
      if (s.language) set.add(s.language);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [initialStars]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialStars.filter((s) => {
      if (language !== "all" && s.language !== language) return false;
      if (changeFilter === "changed") {
        if (s.changeKind !== "new" && s.changeKind !== "updated") return false;
      } else if (changeFilter === "new" && s.changeKind !== "new") {
        return false;
      } else if (changeFilter === "updated" && s.changeKind !== "updated") {
        return false;
      }
      if (!needle) return true;
      const hay = [
        s.repoFullName,
        s.description ?? "",
        s.language ?? "",
        ...s.topics,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [initialStars, language, q, changeFilter]);

  const filteredIds = useMemo(() => filtered.map((s) => s.id), [filtered]);
  const selection = useSelection(filteredIds);

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (
      !confirm(
        `선택한 Star ${selection.selectedCount}개를 로컬 목록에서 삭제할까요?\n(GitHub unstar는 하지 않습니다. 다시 동기화하면 돌아올 수 있습니다.)`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/stars/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  async function ackAll() {
    if (changeCount === 0) return;
    setAcking(true);
    try {
      const res = await fetch("/api/stars/ack", { method: "POST" });
      if (!res.ok) throw new Error("확인 처리 실패");
      router.refresh();
    } catch {
      alert("변경 확인 처리에 실패했습니다.");
    } finally {
      setAcking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitHub Stars</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Star한 레포지토리를 동기화해 관리합니다.
            {initialStars.length > 0 && ` · 총 ${initialStars.length}개`}
            {changeCount > 0 && (
              <span className="text-indigo-600 dark:text-indigo-300">
                {` · 미확인 변경 ${changeCount}건`}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <SyncButton
            hasGithub={hasGithub}
            lastSynced={lastSynced}
            autoSync={autoSyncOnEmpty && hasGithub && initialStars.length === 0}
          />
          {changeCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={acking}
              onClick={() => void ackAll()}
            >
              {acking ? "처리 중…" : `변경 ${changeCount}건 모두 확인`}
            </Button>
          )}
        </div>
      </div>

      {changeCount > 0 && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-900 dark:text-indigo-100">
          신규 {newCount} · 업데이트 {updatedCount}. 카드를 확인한 뒤 「모두
          확인」을 누르면 뱃지가 사라집니다.
        </div>
      )}

      {initialStars.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">검색</label>
            <Input
              placeholder="레포 이름, 설명, 토픽…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="w-full space-y-1 sm:w-40">
            <label className="text-xs text-muted-foreground">변경</label>
            <select
              value={changeFilter}
              onChange={(e) =>
                setChangeFilter(
                  e.target.value as "all" | "changed" | "new" | "updated"
                )
              }
              className="flex h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">전체</option>
              <option value="changed">변경만 ({changeCount})</option>
              <option value="new">신규 ({newCount})</option>
              <option value="updated">업데이트 ({updatedCount})</option>
            </select>
          </div>
          <div className="w-full space-y-1 sm:w-44">
            <label className="text-xs text-muted-foreground">언어</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">전체 언어</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {initialStars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {hasGithub
            ? "동기화 버튼을 눌러 Star 목록을 불러오세요."
            : "GitHub로 로그인한 뒤 동기화하면 Star 목록이 표시됩니다."}
        </div>
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
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              조건에 맞는 Star가 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <StarCard
                  key={s.id}
                  star={s}
                  selectable
                  selected={selection.isSelected(s.id)}
                  onToggleSelect={() => selection.toggle(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
