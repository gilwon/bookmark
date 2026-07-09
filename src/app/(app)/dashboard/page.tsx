// 홈 대시보드 — count 전용 + 최근 N건만 조회
import type { ComponentType } from "react";
import {
  Bookmark,
  Bot,
  FileText,
  FolderOpen,
  GitFork,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import type { Bookmark as BookmarkType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardRecentBookmarks } from "@/components/dashboard/recent-bookmarks";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";

function parseTags(raw: string): string[] {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function toBookmark(
  row: Awaited<ReturnType<typeof store.listRecentBookmarks>>[0]
): BookmarkType {
  return {
    id: row.id,
    userId: row.userId,
    url: row.url,
    title: row.title,
    description: row.description,
    image: row.image,
    favicon: row.favicon,
    tags: parseTags(row.tags),
    category: row.category,
    createdAt: row.createdAt,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const displayName =
    session?.user?.name?.split(" ")[0] ||
    session?.user?.email?.split("@")[0] ||
    "사용자";

  const [counts, categories, recentBookmarkRows, recentStars, recentPages] =
    await Promise.all([
      store.getDashboardCounts(userId),
      store.listCategoryCounts(userId, 8),
      store.listRecentBookmarks(userId, 6),
      store.listRecentStars(userId, 5),
      store.listRecentPages(userId, 5),
    ]);

  const recentBookmarks = recentBookmarkRows.map(toBookmark);
  const maxCat = Math.max(1, ...categories.map((c) => c.count), 1);

  const stats = [
    {
      label: "북마크",
      value: counts.bookmarks,
      href: "/bookmarks",
      icon: Bookmark,
      hint: "저장한 링크",
    },
    {
      label: "카테고리",
      value: counts.categories,
      href: "/bookmarks",
      icon: FolderOpen,
      hint: "분류 개수",
    },
    {
      label: "GitHub Stars",
      value: counts.stars,
      href: "/stars",
      icon: GitFork,
      hint: "동기화된 레포",
    },
    {
      label: "페이지",
      value: counts.pages,
      href: "/pages",
      icon: FileText,
      hint: "메모 페이지",
    },
    {
      label: "에이전트 문서",
      value: counts.agentDocs,
      href: "/agent-docs",
      icon: Bot,
      hint: "SKILL / AGENTS 등",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            안녕하세요, {displayName}님
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            북마크·Star·페이지를 한곳에서 확인하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/bookmarks"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="h-4 w-4" />
            북마크 추가
          </Link>
          <Link
            href="/search"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            <Search className="h-4 w-4" />
            검색
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ label, value, href, icon: Icon, hint }) => (
          <Link key={label} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-indigo-500/40">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {value}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {hint}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-3 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              최근 북마크
            </h2>
            <Link
              href="/bookmarks"
              className="text-xs text-muted-foreground hover:text-indigo-500"
            >
              전체 보기
            </Link>
          </div>
          <DashboardRecentBookmarks bookmarks={recentBookmarks} />
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                카테고리
              </h2>
              <Link
                href="/bookmarks"
                className="text-xs text-muted-foreground hover:text-indigo-500"
              >
                북마크로
              </Link>
            </div>
            <Card>
              <CardContent className="space-y-3 p-4">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    아직 북마크가 없습니다.
                  </p>
                ) : (
                  categories.map((c) => (
                    <div key={c.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium text-foreground">
                          {c.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {c.count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-indigo-500/70"
                          style={{
                            width: `${Math.round((c.count / maxCat) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                최근 Stars
              </h2>
              <Link
                href="/stars"
                className="text-xs text-muted-foreground hover:text-indigo-500"
              >
                전체 보기
              </Link>
            </div>
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {recentStars.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    동기화된 Star가 없습니다.
                  </p>
                ) : (
                  recentStars.map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {s.repoFullName}
                        </p>
                        {s.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {s.language && (
                          <Badge variant="secondary">{s.language}</Badge>
                        )}
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          ★ {s.stars.toLocaleString()}
                        </span>
                      </div>
                    </a>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                최근 페이지
              </h2>
              <Link
                href="/pages"
                className="text-xs text-muted-foreground hover:text-indigo-500"
              >
                전체 보기
              </Link>
            </div>
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {recentPages.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    작성한 페이지가 없습니다.
                  </p>
                ) : (
                  recentPages.map((p) => (
                    <Link
                      key={p.id}
                      href={`/pages/${p.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        수정{" "}
                        {new Date(p.updatedAt).toLocaleDateString("ko-KR")}
                      </p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">빠른 액션</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/bookmarks"
            icon={Plus}
            title="북마크 추가"
            desc="URL 저장 · OG 메타 추출"
          />
          <QuickAction
            href="/bookmarks"
            icon={Upload}
            title="HTML 가져오기"
            desc="브라우저 북마크 일괄 등록"
          />
          <QuickAction
            href="/stars"
            icon={GitFork}
            title="Stars 동기화"
            desc="GitHub Star 목록 갱신"
          />
          <QuickAction
            href="/pages"
            icon={FileText}
            title="새 페이지"
            desc="메모 · URL 불러오기"
          />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-indigo-500/40">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-indigo-300">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
