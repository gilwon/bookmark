// 통합 검색 페이지 — 북마크 · Star · 페이지 · 에이전트 문서
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { BookmarkCard } from "@/components/bookmarks/bookmark-card";
import {
  AgentDocResultCard,
  type AgentDocSearchResult,
} from "@/components/search/agent-doc-result-card";
import { FilterBar } from "@/components/search/filter-bar";
import {
  PageResultCard,
  type PageSearchResult,
} from "@/components/search/page-result-card";
import { StarCard } from "@/components/stars/star-card";
import { auth } from "@/lib/auth";
import { inDateRange } from "@/lib/date-range";
import { db } from "@/lib/db";
import { bundleSearchText, parseBundle } from "@/lib/agent-doc-bundle";
import {
  agentDocs,
  bookmarks,
  customPages,
  githubStars,
} from "@/lib/db/schema";
import { extractTiptapText } from "@/lib/tiptap-text";
import type { AgentDocKind, Bookmark, GithubStar } from "@/lib/types";
import { qall } from "@/lib/db/query";

export const runtime = "nodejs";

type SearchParams = Promise<{
  q?: string;
  type?: string;
  tag?: string;
  category?: string;
  from?: string;
  to?: string;
}>;

/** 본문 미리보기 스니펫을 만든다. */
function makeSnippet(text: string, q: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (!q) return clean.slice(0, max) + (clean.length > max ? "…" : "");
  const lower = clean.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return clean.slice(0, max) + (clean.length > max ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(clean.length, idx + q.length + 80);
  const slice =
    (start > 0 ? "…" : "") +
    clean.slice(start, end) +
    (end < clean.length ? "…" : "");
  return slice;
}

const AGENT_KINDS = new Set<AgentDocKind>([
  "skill",
  "agents",
  "claude",
  "other",
]);

/** 검색어/필터에 맞는 북마크·Star·페이지·에이전트 문서를 통합 표시한다. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const sp = await searchParams;

  const q = (sp.q ?? "").trim().toLowerCase();
  const type = sp.type ?? "all";
  const tag = (sp.tag ?? "").trim().toLowerCase();
  const category = (sp.category ?? "").trim().toLowerCase();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();

  let bookmarkResults: Bookmark[] = [];
  let starResults: GithubStar[] = [];
  let pageResults: PageSearchResult[] = [];
  let agentDocResults: AgentDocSearchResult[] = [];

  if (type === "all" || type === "bookmark") {
    const rows = await qall(db.select().from(bookmarks)      .where(eq(bookmarks.userId, userId)));

    bookmarkResults = rows
      .map((row) => {
        let tags: string[] = [];
        try {
          tags = JSON.parse(row.tags || "[]");
        } catch {
          tags = [];
        }
        return {
          id: row.id,
          userId: row.userId,
          url: row.url,
          title: row.title,
          description: row.description,
          image: row.image,
          favicon: row.favicon,
          tags,
          category: row.category,
          createdAt: row.createdAt,
        } satisfies Bookmark;
      })
      .filter((b) => {
        if (!inDateRange(b.createdAt, from, to)) return false;
        if (category && (b.category ?? "").toLowerCase() !== category) {
          return false;
        }
        if (tag && !b.tags.some((t) => t.toLowerCase() === tag)) {
          return false;
        }
        if (!q) return true;
        const hay = [b.title, b.description ?? "", b.url, ...b.tags]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }

  if (type === "all" || type === "star") {
    // 카테고리 필터는 북마크 전용
    if (!category) {
      const rows = await qall(db.select().from(githubStars)        .where(eq(githubStars.userId, userId)));

      starResults = rows
        .map((row) => {
          let topics: string[] = [];
          try {
            topics = JSON.parse(row.topics || "[]");
          } catch {
            topics = [];
          }
          return {
            id: row.id,
            userId: row.userId,
            repoFullName: row.repoFullName,
            description: row.description,
            language: row.language,
            stars: row.stars,
            topics,
            url: row.url,
            lastSynced: row.lastSynced,
            createdAt: row.createdAt,
          } satisfies GithubStar;
        })
        .filter((s) => {
          if (!inDateRange(s.createdAt, from, to)) return false;
          if (tag && !s.topics.some((t) => t.toLowerCase() === tag)) {
            return false;
          }
          if (!q) return true;
          const hay = [
            s.repoFullName,
            s.description ?? "",
            s.language ?? "",
            ...s.topics,
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
    }
  }

  // 페이지: 태그/카테고리 필터는 해당 없음 → 설정 시 type=all 이면 페이지 제외
  if ((type === "all" || type === "page") && !tag && !category) {
    const rows = await qall(db.select().from(customPages)      .where(eq(customPages.userId, userId)));

    pageResults = rows
      .map((row) => {
        let content: unknown = {};
        try {
          content = JSON.parse(row.content || "{}");
        } catch {
          content = {};
        }
        const bodyText = extractTiptapText(content);
        return {
          id: row.id,
          title: row.title,
          bodyText,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      })
      .filter((p) => {
        // 날짜는 수정일 기준
        if (!inDateRange(p.updatedAt, from, to)) return false;
        if (!q) return true;
        const hay = `${p.title} ${p.bodyText}`.toLowerCase();
        return hay.includes(q);
      })
      .map((p) => ({
        id: p.id,
        title: p.title,
        snippet: makeSnippet(p.bodyText, q),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
  }

  // 에이전트 문서: 태그/카테고리 없음
  if ((type === "all" || type === "agent-doc") && !tag && !category) {
    const rows = await qall(db.select().from(agentDocs)      .where(eq(agentDocs.userId, userId)));

    agentDocResults = rows
      .map((row) => {
        const files = parseBundle(row.bundle);
        const searchBody = bundleSearchText(row.content, files);
        return { row, files, searchBody };
      })
      .filter(({ row, searchBody }) => {
        if (!inDateRange(row.updatedAt, from, to)) return false;
        if (!q) return true;
        const hay = [
          row.title,
          row.filename,
          row.description ?? "",
          row.kind,
          searchBody,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .map(({ row, files, searchBody }) => ({
        id: row.id,
        title: row.title,
        filename:
          files.length > 1
            ? files.map((f) => f.filename).join(" + ")
            : row.filename,
        kind: AGENT_KINDS.has(row.kind as AgentDocKind)
          ? (row.kind as AgentDocKind)
          : "other",
        fileCount: Math.max(files.length, 1),
        snippet: makeSnippet(
          [row.description ?? "", searchBody].join("\n"),
          q
        ),
        updatedAt: row.updatedAt,
      }));
  }

  const hasQuery = Boolean(
    q || tag || category || from || to || (type && type !== "all")
  );
  const total =
    bookmarkResults.length +
    starResults.length +
    pageResults.length +
    agentDocResults.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">검색</h1>
        <p className="text-sm text-muted-foreground mt-1">
          북마크, Stars, 페이지, 에이전트 문서를 통합 검색합니다.
        </p>
      </div>

      <Suspense
        fallback={<div className="text-sm text-muted-foreground">로딩…</div>}
      >
        <FilterBar />
      </Suspense>

      {hasQuery && (
        <p className="text-sm text-muted-foreground">
          결과 {total}건
          {bookmarkResults.length > 0 && ` · 북마크 ${bookmarkResults.length}`}
          {starResults.length > 0 && ` · Star ${starResults.length}`}
          {pageResults.length > 0 && ` · 페이지 ${pageResults.length}`}
          {agentDocResults.length > 0 &&
            ` · 에이전트 문서 ${agentDocResults.length}`}
          {(from || to) && ` · 기간 ${from || "…"} ~ ${to || "…"}`}
        </p>
      )}

      {!hasQuery ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          검색어 또는 필터를 입력하세요.
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          검색 결과가 없습니다.
        </div>
      ) : (
        <div className="space-y-8">
          {bookmarkResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                북마크
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {bookmarkResults.map((b) => (
                  <BookmarkCard key={b.id} bookmark={b} />
                ))}
              </div>
            </section>
          )}
          {starResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                GitHub Stars
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {starResults.map((s) => (
                  <StarCard key={s.id} star={s} />
                ))}
              </div>
            </section>
          )}
          {pageResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                페이지
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pageResults.map((p) => (
                  <PageResultCard key={p.id} page={p} />
                ))}
              </div>
            </section>
          )}
          {agentDocResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                에이전트 문서
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {agentDocResults.map((d) => (
                  <AgentDocResultCard key={d.id} doc={d} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
