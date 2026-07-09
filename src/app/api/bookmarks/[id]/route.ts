// 북마크 수정 / 삭제 API — user_id 소유권 필수
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema";
import { qget, qrun } from "@/lib/db/query";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** 소유 북마크 행 조회 */
async function getOwned(id: string, userId: string) {
  return await qget(
    db.select().from(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId))));
}

/** PATCH /api/bookmarks/:id */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = await getOwned(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = await req.json().catch(() => ({}));
  const updates: Partial<typeof bookmarks.$inferInsert> = {};

  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.description === "string")
    updates.description = body.description;
  if (typeof body.category === "string") updates.category = body.category;
  if (Array.isArray(body.tags)) updates.tags = JSON.stringify(body.tags);

  if (Object.keys(updates).length > 0) {
    await qrun(db.update(bookmarks)
      .set(updates)
      .where(
        and(eq(bookmarks.id, id), eq(bookmarks.userId, gate.user.userId))
      ));
  }

  const row = await getOwned(id, gate.user.userId)!;
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch {
    tags = [];
  }

  return NextResponse.json({
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
  });
}

/** DELETE /api/bookmarks/:id */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = await getOwned(id, gate.user.userId);
  if (!existing) return ownershipError();

  await qrun(db.delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, gate.user.userId))));
  return NextResponse.json({ ok: true });
}
