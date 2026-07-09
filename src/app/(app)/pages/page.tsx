// 커스텀 페이지 목록
import { PageList } from "@/components/pages/page-list";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import type { CustomPage } from "@/lib/types";

export const runtime = "nodejs";

export default async function PagesPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const rows = await store.listPages(userId);

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
          노트를 작성하거나, URL을 불러와 마크다운으로 저장할 수 있습니다.
        </p>
      </div>
      <PageList pages={list} />
    </div>
  );
}
