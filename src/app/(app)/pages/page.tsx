// 커스텀 페이지 목록
import { desc, eq } from "drizzle-orm";
import { PageList } from "@/components/pages/page-list";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customPages } from "@/lib/db/schema";
import type { CustomPage } from "@/lib/types";
import { qall } from "@/lib/db/query";

export const runtime = "nodejs";

/** 페이지 목록 화면 */
export default async function PagesPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const rows = await qall(db.select().from(customPages)    .where(eq(customPages.userId, userId)).orderBy(desc(customPages.updatedAt)));

  const list: CustomPage[] = rows.map((row) => {
    let content: unknown = {};
    try {
      content = JSON.parse(row.content || "{}");
    } catch {
      content = {};
    }
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">페이지</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notion처럼 자유롭게 노트를 작성하세요.
        </p>
      </div>
      <PageList pages={list} />
    </div>
  );
}
