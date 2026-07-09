// 페이지에 삽입할 북마크·Star를 고르는 피커
"use client";

import { Bookmark, GitFork, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Bookmark as BookmarkType, GithubStar } from "@/lib/types";
import type { EmbedAttrs } from "@/components/pages/extensions/embed-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  bookmarks: BookmarkType[];
  stars: GithubStar[];
  onPick: (attrs: EmbedAttrs) => void;
};

/** 북마크/Star 목록에서 하나를 골라 임베드 속성으로 반환한다. */
export function EmbedPicker({ bookmarks, stars, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"bookmark" | "star">("bookmark");
  const [q, setQ] = useState("");

  const filteredBookmarks = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return bookmarks;
    return bookmarks.filter((b) =>
      [b.title, b.url, b.description ?? "", ...b.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [bookmarks, q]);

  const filteredStars = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stars;
    return stars.filter((s) =>
      [s.repoFullName, s.description ?? "", s.language ?? "", ...s.topics]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [stars, q]);

  /** 북마크를 임베드 속성으로 변환한다. */
  function pickBookmark(b: BookmarkType) {
    let subtitle = "";
    try {
      subtitle = new URL(b.url).hostname;
    } catch {
      subtitle = b.category ?? "";
    }
    onPick({
      kind: "bookmark",
      refId: b.id,
      title: b.title,
      url: b.url,
      description: b.description,
      image: b.image,
      subtitle,
    });
    setOpen(false);
    setQ("");
  }

  /** Star를 임베드 속성으로 변환한다. */
  function pickStar(s: GithubStar) {
    const parts = [
      s.language,
      s.stars > 0 ? `★ ${s.stars.toLocaleString()}` : null,
    ].filter(Boolean);
    onPick({
      kind: "star",
      refId: s.id,
      title: s.repoFullName,
      url: s.url,
      description: s.description,
      image: null,
      subtitle: parts.join(" · ") || null,
    });
    setOpen(false);
    setQ("");
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-4 w-4 mr-1" />
        임베드
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="피커 닫기"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-card shadow-xl">
            <div className="flex border-b border-border">
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-sm ${
                  tab === "bookmark"
                    ? "text-indigo-300 border-b-2 border-indigo-500"
                    : "text-muted-foreground"
                }`}
                onClick={() => setTab("bookmark")}
              >
                북마크
              </button>
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-sm ${
                  tab === "star"
                    ? "text-indigo-300 border-b-2 border-indigo-500"
                    : "text-muted-foreground"
                }`}
                onClick={() => setTab("star")}
              >
                Stars
              </button>
            </div>
            <div className="p-2">
              <Input
                placeholder={
                  tab === "bookmark" ? "북마크 검색…" : "레포 검색…"
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <ul className="max-h-64 overflow-y-auto px-1 pb-2">
              {tab === "bookmark" &&
                (filteredBookmarks.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    삽입할 북마크가 없습니다.
                  </li>
                ) : (
                  filteredBookmarks.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted"
                        onClick={() => pickBookmark(b)}
                      >
                        <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">
                            {b.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {b.url}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                ))}
              {tab === "star" &&
                (filteredStars.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    삽입할 Star가 없습니다.
                  </li>
                ) : (
                  filteredStars.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted"
                        onClick={() => pickStar(s)}
                      >
                        <GitFork className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">
                            {s.repoFullName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.description ?? s.language ?? s.url}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
