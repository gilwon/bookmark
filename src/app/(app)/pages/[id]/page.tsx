// 커스텀 페이지 에디터 (노션형 입력·수정·저장)
import Link from "next/link";
import { notFound } from "next/navigation";
import { TiptapEditor } from "@/components/pages/tiptap-editor";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import type { Bookmark, GithubStar } from "@/lib/types";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function PageEditorPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;

  const row = await store.getPage(id, userId);
  if (!row) notFound();

  let content: unknown = {};
  try {
    content = JSON.parse(row.content || "{}");
  } catch {
    content = {};
  }

  // 임베드 피커용 — 목록만 (본문 전체 불필요)
  const [bookmarkRows, starRows] = await Promise.all([
    store.listBookmarks(userId),
    store.listStarsBySynced(userId),
  ]);

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
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/pages"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 페이지 목록
        </Link>
        <p className="text-[11px] text-muted-foreground">
          입력하면 자동 저장 · ⌘/Ctrl+S
        </p>
      </div>
      <TiptapEditor
        pageId={row.id}
        initialTitle={row.title}
        initialContent={content}
        initialUpdatedAt={row.updatedAt}
        bookmarks={bookmarkList}
        stars={starList}
      />
    </div>
  );
}
