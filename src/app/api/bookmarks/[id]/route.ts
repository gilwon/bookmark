// 북마크 수정 / 삭제 API
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/bookmarks/:id — 제목/태그/카테고리 등 부분 수정 */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, session.user.id)))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Partial<typeof bookmarks.$inferInsert> = {};

  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.category === "string") updates.category = body.category;
  if (Array.isArray(body.tags)) updates.tags = JSON.stringify(body.tags);

  if (Object.keys(updates).length > 0) {
    db.update(bookmarks).set(updates).where(eq(bookmarks.id, id)).run();
  }

  const row = db.select().from(bookmarks).where(eq(bookmarks.id, id)).get()!;
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, session.user.id)))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  db.delete(bookmarks).where(eq(bookmarks.id, id)).run();
  return NextResponse.json({ ok: true });
}
