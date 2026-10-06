// X 북마크 목록. 연결, 동기화, 화면 안 검색
"use client";

import { BookmarkCheck, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { XBookmarkRow } from "@/lib/store";
import { X_BOOKMARKS_TABLE_USER_MESSAGE } from "@/lib/x-bookmarks";

type Props = {
  items: XBookmarkRow[];
  hasXApp: boolean;
  hasX: boolean;
  tableMissing: boolean;
  callbackUrl: string;
  lastSynced: string | null;
  notice: string;
  connected: boolean;
};

const NOTICE: Record<string, string> = {
  state: "연결 확인에 실패했습니다. 다시 연결해 주세요.",
  config: "X 앱 키가 없습니다.",
  code: "X 인가 코드가 없습니다. 다시 연결해 주세요.",
  token: "X 인증에 실패했습니다. 다시 연결해 주세요.",
  denied: "X 연결을 취소했습니다.",
};

function formatPosted(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(time);
}

function formatRelative(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(time);
}

export function XBookmarksView({
  items,
  hasXApp,
  hasX,
  tableMissing,
  callbackUrl,
  lastSynced,
  notice,
  connected,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(connected ? "X 계정을 연결했습니다." : "");
  const [error, setError] = useState(NOTICE[notice] ?? "");
  const autoTried = useRef(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const hay = [
        item.text,
        item.authorName,
        item.authorUsername,
        item.url,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  async function sync() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/x-bookmarks/sync", { method: "POST" });
      const json = (await res.json()) as {
        error?: string;
        added?: number;
        updated?: number;
        count?: number;
      };
      if (!res.ok) {
        setError(json.error || "동기화에 실패했습니다.");
        return;
      }
      setMessage(
        `불러왔습니다. 신규 ${json.added ?? 0}개, 갱신 ${json.updated ?? 0}개.`
      );
      router.refresh();
    } catch {
      setError("동기화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/x/disconnect", { method: "POST" });
      if (!res.ok) {
        setError("연결 해제에 실패했습니다.");
        return;
      }
      setMessage("X 연결을 해제했습니다.");
      router.refresh();
    } catch {
      setError("연결 해제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasX || !hasXApp || tableMissing || items.length > 0 || autoTried.current) {
      return;
    }
    autoTried.current = true;
    void sync();
    // 빈 목록일 때 한 번만 동기화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasX, hasXApp, tableMissing, items.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-medium tracking-[-0.02em]">
            <BookmarkCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
            X북마크
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            X에 북마크한 게시를 이 화면에 불러옵니다.
            {items.length > 0 && ` 총 ${items.length}개.`}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {hasXApp && hasX && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void sync()}
              disabled={loading || tableMissing}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "동기화 중…" : "동기화"}
            </Button>
          )}
          {hasXApp && !hasX && (
            <Button
              type="button"
              onClick={() => {
                window.location.href = "/api/x/connect";
              }}
            >
              X 연결
            </Button>
          )}
          {hasX && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void disconnect()}
              disabled={loading}
            >
              연결 해제
            </Button>
          )}
          {!loading && message && (
            <p className="max-w-sm text-right text-xs font-medium text-indigo-600 dark:text-indigo-300">
              {message}
            </p>
          )}
          {!loading && error && (
            <p className="max-w-sm text-right text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {!loading && !message && !error && lastSynced && (
            <p className="max-w-xs text-right text-xs text-muted-foreground">
              마지막 동기화 {formatRelative(lastSynced)}
            </p>
          )}
        </div>
      </div>

      {tableMissing && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-900 dark:text-amber-100">
          {X_BOOKMARKS_TABLE_USER_MESSAGE}
        </div>
      )}

      {!hasXApp && (
        <div className="space-y-2 rounded-xl border border-border bg-card/40 p-4 text-sm">
          <p className="font-medium">X 개발자 앱 키가 없습니다.</p>
          <p className="text-muted-foreground">
            developer.x.com에서 앱을 만든 뒤 Client ID와 Client Secret을
            .env.local의 X_CLIENT_ID, X_CLIENT_SECRET에 넣으면 연결할 수 있습니다.
            권한은 bookmark.read, tweet.read, users.read, offline.access입니다.
          </p>
          <p className="text-muted-foreground">개발자 포털에 등록할 콜백 주소입니다.</p>
          <code className="block overflow-x-auto rounded-md bg-muted px-2 py-1 text-xs">
            {callbackUrl}
          </code>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-1">
          <label htmlFor="x-bookmark-q" className="text-xs text-muted-foreground">
            검색
          </label>
          <Input
            id="x-bookmark-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="본문, 작성자, 주소"
            className="max-w-md"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {items.length > 0
            ? "검색과 맞는 북마크가 없습니다."
            : hasX
              ? "아직 불러온 북마크가 없습니다. 동기화를 눌러 주세요."
              : "X를 연결한 뒤 동기화하면 여기에 표시됩니다."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card/40 p-4 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.authorName || "작성자 없음"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.authorUsername ? `@${item.authorUsername}` : "계정 없음"}
                  {item.postedAt ? ` · ${formatPosted(item.postedAt)}` : ""}
                </p>
              </div>
              <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-6">
                {item.text || "본문이 없습니다."}
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-auto text-sm font-medium text-indigo-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-300"
              >
                X에서 보기
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
