// GitHub Star 상세 — 레포 정보와 README 사용법.
"use client";

import {
  ArrowLeft,
  ExternalLink,
  Pin,
  RefreshCw,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StarReadme } from "@/components/stars/star-readme";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { parseStarDetailJson } from "@/lib/star-detail";
import type { GithubStar } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatPushedAt(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

/** 등록된 Star를 상세 레이아웃으로 표시한다. */
export function StarDetail({ star: initialStar }: { star: GithubStar }) {
  const router = useRouter();
  const [star, setStar] = useState(initialStar);
  const [loading, setLoading] = useState(!initialStar.detailFetchedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (force: boolean, id = initialStar.id, signal?: AbortSignal) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const qs = force ? "?force=1" : "";
        const res = await fetch(`/api/stars/${id}/detail${qs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
          signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          star?: GithubStar;
          error?: string;
        };
        if (signal?.aborted) return;
        if (!res.ok) {
          throw new Error(data.error || "레포 정보를 가져오지 못했습니다.");
        }
        if (data.star) setStar(data.star);
      } catch (err) {
        if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "레포 정보를 가져오지 못했습니다."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [initialStar.id]
  );

  useEffect(() => {
    setStar(initialStar);
    setError(null);
    if (initialStar.detailFetchedAt) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    void loadDetail(false, initialStar.id, ac.signal);
    return () => ac.abort();
  }, [initialStar.id, initialStar.detailFetchedAt, loadDetail]);

  async function toggleFavorite() {
    if (favoriting) return;
    setFavoriting(true);
    try {
      const res = await fetch(`/api/stars/${star.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !star.isFavorite }),
      });
      if (res.ok) {
        setStar((s) => ({ ...s, isFavorite: !s.isFavorite }));
        router.refresh();
      }
    } finally {
      setFavoriting(false);
    }
  }

  const detail = parseStarDetailJson(star.detailJson);
  const homepage =
    detail?.homepage && /^https?:\/\//i.test(detail.homepage)
      ? detail.homepage
      : null;
  const pushedAt = formatPushedAt(detail?.pushedAt ?? null);

  return (
    <article className="w-full min-w-0 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          href="/stars"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          목록으로
        </Link>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "min-h-10 justify-start sm:justify-center",
              star.isFavorite
                ? "text-sky-600 dark:text-sky-400"
                : "text-muted-foreground"
            )}
            onClick={() => void toggleFavorite()}
            disabled={favoriting}
            title={star.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
            aria-label={star.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
            aria-pressed={star.isFavorite}
          >
            <Pin
              className={cn("h-4 w-4", star.isFavorite && "fill-current")}
            />
            {star.isFavorite ? "고정됨" : "고정"}
          </Button>
          <a
            href={star.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "min-h-10 justify-start sm:justify-center"
            )}
          >
            <ExternalLink className="h-4 w-4" />
            GitHub에서 열기
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 justify-start sm:justify-center"
            onClick={() => void loadDetail(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
            정보 다시 가져오기
          </Button>
        </div>
      </div>

      <header className="space-y-4 border-b border-border pb-6">
        <h1 className="break-all text-2xl font-bold tracking-tight sm:text-3xl">
          {star.repoFullName}
        </h1>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {star.language && (
            <div className="min-w-0">
              <dt className="text-muted-foreground">언어</dt>
              <dd className="mt-0.5">
                <Badge variant="default">{star.language}</Badge>
              </dd>
            </div>
          )}
          <div className="min-w-0">
            <dt className="text-muted-foreground">Stars</dt>
            <dd className="mt-0.5 flex items-center gap-1 tabular-nums">
              <Star className="h-3.5 w-3.5 text-amber-500" />
              {star.stars.toLocaleString()}
            </dd>
          </div>
          {detail && (
            <>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Forks</dt>
                <dd className="mt-0.5 tabular-nums">
                  {detail.forks.toLocaleString()}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Open issues</dt>
                <dd className="mt-0.5 tabular-nums">
                  {detail.openIssues.toLocaleString()}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Watchers</dt>
                <dd className="mt-0.5 tabular-nums">
                  {detail.watchers.toLocaleString()}
                </dd>
              </div>
              {detail.license && (
                <div className="min-w-0">
                  <dt className="text-muted-foreground">라이선스</dt>
                  <dd className="mt-0.5 break-words">{detail.license}</dd>
                </div>
              )}
              {detail.defaultBranch && (
                <div className="min-w-0">
                  <dt className="text-muted-foreground">기본 브랜치</dt>
                  <dd className="mt-0.5 font-mono text-[13px]">
                    {detail.defaultBranch}
                  </dd>
                </div>
              )}
              {homepage && (
                <div className="min-w-0">
                  <dt className="text-muted-foreground">홈페이지</dt>
                  <dd className="mt-0.5">
                    <a
                      href={homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {homepage}
                    </a>
                  </dd>
                </div>
              )}
              {pushedAt && (
                <div className="min-w-0">
                  <dt className="text-muted-foreground">최근 push</dt>
                  <dd className="mt-0.5">{pushedAt}</dd>
                </div>
              )}
            </>
          )}
        </dl>
        {star.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {star.topics.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {star.description && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">설명</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {star.description}
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">README · 사용법</h2>
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          {loading && !star.detailFetchedAt ? (
            <p className="text-sm text-muted-foreground">
              레포 정보를 가져오는 중…
            </p>
          ) : error && !star.detailFetchedAt ? (
            <div className="space-y-3">
              <p className="text-sm text-red-500">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() => void loadDetail(false)}
              >
                다시 시도
              </Button>
            </div>
          ) : !star.readmeMd ? (
            <div className="space-y-3">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <p className="text-sm text-muted-foreground">
                README가 없습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <StarReadme markdown={star.readmeMd} />
            </div>
          )}
        </div>
      </section>
    </article>
  );
}
