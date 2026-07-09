// Stars 페이지 클라이언트 — 검색/언어 필터 + 자동 동기화
"use client";

import { useMemo, useState } from "react";
import type { GithubStar } from "@/lib/types";
import { StarCard } from "@/components/stars/star-card";
import { SyncButton } from "@/components/stars/sync-button";
import { Input } from "@/components/ui/input";

type Props = {
  initialStars: GithubStar[];
  hasGithub: boolean;
  lastSynced: string | null;
  /** 목록이 비어 있고 GitHub 연동 시 자동 동기화 */
  autoSyncOnEmpty: boolean;
};

/** Star 목록 UI + 필터 + 동기화 컨트롤 */
export function StarsView({
  initialStars,
  hasGithub,
  lastSynced,
  autoSyncOnEmpty,
}: Props) {
  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("all");

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
  }, [initialStars, language, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitHub Stars</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Star한 레포지토리를 동기화해 관리합니다.
            {initialStars.length > 0 && ` · 총 ${initialStars.length}개`}
          </p>
        </div>
        <SyncButton
          hasGithub={hasGithub}
          lastSynced={lastSynced}
          autoSync={autoSyncOnEmpty && hasGithub && initialStars.length === 0}
        />
      </div>

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
          <div className="space-y-1 w-full sm:w-44">
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
            ? "동기화된 Star가 없습니다. 자동 동기화를 기다리거나 동기화 버튼을 눌러 주세요."
            : "GitHub로 로그인한 뒤 동기화하면 Star 목록이 표시됩니다."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          필터 조건에 맞는 레포가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            표시 {filtered.length}
            {filtered.length !== initialStars.length &&
              ` / ${initialStars.length}`}
            개
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <StarCard key={s.id} star={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
