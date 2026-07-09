// 커스텀 페이지 에디터
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TiptapEditor } from "@/components/pages/tiptap-editor";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customPages } from "@/lib/db/schema";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

/** 단일 페이지 편집 화면 */
export default async function PageEditorPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;

  const row = db
    .select()
    .from(customPages)
    .where(
      and(eq(customPages.id, id), eq(customPages.userId, session!.user!.id))
    )
    .get();

  if (!row) notFound();

  let content: unknown = {};
  try {
    content = JSON.parse(row.content || "{}");
  } catch {
    content = {};
  }

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
      />
    </div>
  );
}
