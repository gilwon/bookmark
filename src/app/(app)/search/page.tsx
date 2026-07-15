// 통합 검색 — DB 필터(search*) 후 결과 표시
import { Suspense } from "react";
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
import {
  PromptResultCard,
  type PromptSearchResult,
} from "@/components/search/prompt-result-card";
import { StarCard } from "@/components/stars/star-card";
import { parseBundle } from "@/lib/agent-doc-bundle";
import { auth } from "@/lib/auth";
import { parsePromptSections } from "@/lib/prompt-mapper";
import { store } from "@/lib/store";
import { extractTiptapText } from "@/lib/tiptap-text";
import type { AgentDocKind, Bookmark, GithubStar } from "@/lib/types";

export const runtime = "nodejs";

type SearchParams = Promise<{
  q?: string;
  type?: string;
  tag?: string;
  category?: string;
  from?: string;
  to?: string;
}>;

function makeSnippet(text: string, q: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (!q) return clean.slice(0, max) + (clean.length > max ? "…" : "");
  const lower = clean.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return clean.slice(0, max) + (clean.length > max ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(clean.length, idx + q.length + 80);
  return (
    (start > 0 ? "…" : "") +
    clean.slice(start, end) +
    (end < clean.length ? "…" : "")
  );
}

const AGENT_KINDS = new Set<AgentDocKind>([
  "skill",
  "agents",
  "claude",
  "other",
]);

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const type = sp.type ?? "all";
  const tag = (sp.tag ?? "").trim();
  const category = (sp.category ?? "").trim();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();

  const opts = { q, tag, category, from, to, limit: 80 };

  let bookmarkResults: Bookmark[] = [];
  let starResults: GithubStar[] = [];
  let pageResults: PageSearchResult[] = [];
  let agentDocResults: AgentDocSearchResult[] = [];
  let promptResults: PromptSearchResult[] = [];

  if (type === "all" || type === "bookmark") {
    const rows = await store.searchBookmarks(userId, opts);
    bookmarkResults = rows.map((row) => {
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
        isFavorite: Boolean(row.isFavorite),
        createdAt: row.createdAt,
      };
    });
  }

  if ((type === "all" || type === "star") && !category) {
    const rows = await store.searchStars(userId, opts);
    const { rowToGithubStar } = await import("@/lib/star-mapper");
    starResults = rows.map(rowToGithubStar);
  }

  if ((type === "all" || type === "page") && !tag && !category) {
    const rows = await store.searchPages(userId, opts);
    pageResults = rows.map((row) => {
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
        snippet: makeSnippet(bodyText || row.title, q),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  if ((type === "all" || type === "agent-doc") && !tag && !category) {
    const rows = await store.searchAgentDocs(userId, opts);
    agentDocResults = rows.map((row) => {
      const files = parseBundle(row.bundle);
      const body = [row.description ?? "", row.content, row.bundle].join("\n");
      return {
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
        snippet: makeSnippet(body, q),
        updatedAt: row.updatedAt,
      };
    });
  }

  if ((type === "all" || type === "prompt") && !tag && !category) {
    const rows = await store.searchPrompts(userId, opts);
    promptResults = rows.map((row) => {
      const sections = parsePromptSections(row.sections);
      const body = [
        row.summary ?? "",
        row.whenToUse ?? "",
        ...sections.map((s) => `${s.title}\n${s.body}`),
      ].join("\n");
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        snippet: makeSnippet(body || row.title, q),
        updatedAt: row.updatedAt,
      };
    });
  }

  const hasQuery = Boolean(
    q || tag || category || from || to || (type && type !== "all")
  );
  const total =
    bookmarkResults.length +
    starResults.length +
    pageResults.length +
    agentDocResults.length +
    promptResults.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">검색</h1>
        <p className="text-sm text-muted-foreground mt-1">
          북마크, Stars, 페이지, 프롬프트, 에이전트 문서를 통합 검색합니다.
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
          {q ? ` · “${q}”` : ""}
        </p>
      )}

      {!hasQuery ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          검색어 또는 필터를 입력하세요.
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          일치하는 결과가 없습니다.
        </div>
      ) : (
        <div className="space-y-8">
          {bookmarkResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                북마크 ({bookmarkResults.length})
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
              <h2 className="text-sm font-semibold">
                Stars ({starResults.length})
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
              <h2 className="text-sm font-semibold">
                페이지 ({pageResults.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {pageResults.map((p) => (
                  <PageResultCard key={p.id} page={p} />
                ))}
              </div>
            </section>
          )}
          {promptResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                프롬프트 ({promptResults.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {promptResults.map((p) => (
                  <PromptResultCard key={p.id} prompt={p} />
                ))}
              </div>
            </section>
          )}
          {agentDocResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                에이전트 문서 ({agentDocResults.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
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
