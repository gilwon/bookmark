// 커스텀 페이지 에디터 (임베드용 북마크·Star 목록 포함)
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TiptapEditor } from "@/components/pages/tiptap-editor";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookmarks, customPages, githubStars } from "@/lib/db/schema";
import type { Bookmark, GithubStar } from "@/lib/types";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

/** 단일 페이지 편집 화면 */
export default async function PageEditorPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;

  const row = db
    .select()
    .from(customPages)
    .where(and(eq(customPages.id, id), eq(customPages.userId, userId)))
    .get();

  if (!row) notFound();

  let content: unknown = {};
  try {
    content = JSON.parse(row.content || "{}");
  } catch {
    content = {};
  }

  const bookmarkRows = db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))
    .all();

  const starRows = db
    .select()
    .from(githubStars)
    .where(eq(githubStars.userId, userId))
    .orderBy(desc(githubStars.lastSynced))
    .all();

  const bookmarkList: Bookmark[] = bookmarkRows.map((b) => {
    let tags: string[] = [];
    try {
      tags = JSON.parse(b.tags || "[]");
    } catch {
      tags = [];
    }
    return {
      id: b.id,
      userId: b.userId,
      url: b.url,
      title: b.title,
      description: b.description,
      image: b.image,
      favicon: b.favicon,
      tags,
      category: b.category,
      createdAt: b.createdAt,
    };
  });

  const starList: GithubStar[] = starRows.map((s) => {
    let topics: string[] = [];
    try {
      topics = JSON.parse(s.topics || "[]");
    } catch {
      topics = [];
    }
    return {
      id: s.id,
      userId: s.userId,
      repoFullName: s.repoFullName,
      description: s.description,
      language: s.language,
      stars: s.stars,
      topics,
      url: s.url,
      lastSynced: s.lastSynced,
      createdAt: s.createdAt,
    };
  });

  return (
    <div className="space-y-4">
      <Link
        href="/pages"
        className="text-sm text-zinc-400 hover:text-zinc-200"
      >
        ← 페이지 목록
      </Link>
      <TiptapEditor
        pageId={row.id}
        initialTitle={row.title}
        initialContent={content}
        bookmarks={bookmarkList}
        stars={starList}
      />
    </div>
  );
}
