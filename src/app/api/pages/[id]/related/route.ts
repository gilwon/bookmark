// 같은 사용자 페이지·북마크 중 관련 항목
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { pickRelated } from "@/lib/page-related";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const row = await store.getPage(id, gate.user.userId);
  if (!row) return ownershipError();

  const [pageRows, bookmarkRows] = await Promise.all([
    store.listPages(gate.user.userId),
    store.listBookmarks(gate.user.userId, { limit: 2000 }),
  ]);

  const related = pickRelated(
    {
      id: row.id,
      title: row.title,
      sourceUrl: row.sourceUrl ?? null,
    },
    pageRows.map((p) => ({
      id: p.id,
      title: p.title,
      sourceUrl: p.sourceUrl ?? null,
    })),
    bookmarkRows.map((b) => ({
      id: b.id,
      title: b.title,
      url: b.url,
      category: b.category ?? null,
    }))
  );

  return NextResponse.json(related);
}
