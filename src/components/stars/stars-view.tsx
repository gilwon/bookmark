// Stars 페이지 — 정렬·수동 추가·필터·동기화·선택 삭제
"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GithubStar } from "@/lib/types";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import { StarCard } from "@/components/stars/star-card";
import { SyncButton } from "@/components/stars/sync-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SearchSuggestInput,
  type SearchSuggestItem,
} from "@/components/ui/search-suggest-input";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";

type Props = {
  initialStars: GithubStar[];
  hasGithub: boolean;
  lastSynced: string | null;
  autoSyncOnEmpty: boolean;
};

type SortKey = "name" | "stars" | "created";

const selectClass =
  "flex h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Star 목록 UI + 정렬·수동 추가 + 변경 필터 */
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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [deleting, setDeleting] = useState(false);
  const [acking, setAcking] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addMsg, setAddMsg] = useState<string | null>(null);

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

  const searchSuggestions = useMemo((): SearchSuggestItem[] => {
    const items: SearchSuggestItem[] = [];
    for (const s of initialStars) {
      if (s.repoFullName?.trim()) {
        items.push({
          value: s.repoFullName.trim(),
          label: s.repoFullName.trim(),
          group: "레포",
        });
      }
      if (s.language?.trim()) {
        items.push({
          value: s.language.trim(),
          label: s.language.trim(),
          group: "언어",
        });
      }
      for (const t of s.topics ?? []) {
        const topic = t.trim();
        if (topic) {
          items.push({ value: topic, label: topic, group: "토픽" });
        }
      }
    }
    return items;
  }, [initialStars]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = initialStars.filter((s) => {
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

    const sorted = [...list];
    sorted.sort((a, b) => {
      // 변경 뱃지 우선은 유지하되, 같은 그룹 안에서 선택 정렬
      const aw = a.changeKind ? 1 : 0;
      const bw = b.changeKind ? 1 : 0;
      if (aw !== bw) return bw - aw;

      if (sortKey === "name") {
        return a.repoFullName.localeCompare(b.repoFullName, "en", {
          sensitivity: "base",
        });
      }
      if (sortKey === "stars") {
        const d = (b.stars ?? 0) - (a.stars ?? 0);
        if (d !== 0) return d;
        return a.repoFullName.localeCompare(b.repoFullName, "en");
      }
      // 등록순 (createdAt 최신 먼저)
      const ta = Date.parse(a.createdAt) || 0;
      const tb = Date.parse(b.createdAt) || 0;
      if (tb !== ta) return tb - ta;
      return a.repoFullName.localeCompare(b.repoFullName, "en");
    });
    return sorted;
  }, [initialStars, language, q, changeFilter, sortKey]);

  const filteredIds = useMemo(() => filtered.map((s) => s.id), [filtered]);
  const selection = useSelection(filteredIds);

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (
      !confirm(
        `선택한 Star ${selection.selectedCount}개를 로컬 목록에서 삭제할까요?\n(GitHub unstar는 하지 않습니다. 수동 추가 레포는 동기화해도 다시 생기지 않습니다.)`
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

  async function handleAddRepo() {
    const raw = repoInput.trim();
    if (!raw) {
      setAddError("owner/repo 또는 GitHub URL 을 입력하세요.");
      return;
    }
    setAdding(true);
    setAddError(null);
    setAddMsg(null);
    try {
      const res = await fetch("/api/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "레포 추가 실패"
        );
      }
      const name =
        (data as { repoFullName?: string }).repoFullName || raw;
      setRepoInput("");
      setAddMsg(`「${name}」을(를) 목록에 추가했습니다.`);
      router.refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "레포 추가 실패");
    } finally {
      setAdding(false);
    }
  }

  const showFilters = initialStars.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitHub Stars</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Star 동기화 또는 레포 직접 추가로로 관리합니다.
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

      {/* 레포 직접 추가 */}
      <div className="space-y-2 rounded-xl border border-border bg-card/40 p-4">
        <p className="text-sm font-medium">레포 직접 추가</p>
        <p className="text-xs text-muted-foreground">
          <code className="text-[11px]">owner/repo</code> 또는 GitHub URL.
          수동 추가는 동기화 시 목록에서 지워지지 않습니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="vercel/next.js 또는 https://github.com/vercel/next.js"
            className="flex-1 font-mono text-sm"
            disabled={adding}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddRepo();
              }
            }}
          />
          <Button
            type="button"
            disabled={adding}
            onClick={() => void handleAddRepo()}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            {adding ? "추가 중…" : "추가"}
          </Button>
        </div>
        {addError && <p className="text-sm text-red-400">{addError}</p>}
        {addMsg && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {addMsg}
          </p>
        )}
      </div>

      {changeCount > 0 && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-900 dark:text-indigo-100">
          신규 {newCount} · 업데이트 {updatedCount}. 카드를 확인한 뒤 「모두
          확인」을 누르면 뱃지가 사라집니다.
        </div>
      )}

      {showFilters && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">검색</label>
            <SearchSuggestInput
              placeholder="레포 이름, 설명, 토픽…"
              value={q}
              onChange={setQ}
              suggestions={searchSuggestions}
            />
          </div>
          <div className="w-full space-y-1 sm:w-36">
            <label className="text-xs text-muted-foreground">정렬</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className={selectClass}
            >
              <option value="name">이름순</option>
              <option value="stars">Stars 순</option>
              <option value="created">등록순</option>
            </select>
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
              className={selectClass}
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
              className={selectClass}
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
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {hasGithub
            ? "동기화하거나 위에서 레포를 직접 추가해 보세요."
            : "GitHub 로그인 후 동기화하거나, 공개 레포를 직접 추가할 수 있습니다."}
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
