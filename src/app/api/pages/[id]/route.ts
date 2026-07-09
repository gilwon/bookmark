// 커스텀 페이지 단건 조회 / 수정 / 삭제
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customPages } from "@/lib/db/schema";
import type { CustomPage } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** DB 행 → CustomPage */
function toPage(row: typeof customPages.$inferSelect): CustomPage {
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
}

/** 소유자 페이지를 조회한다. */
function getOwned(id: string, userId: string) {
  return db
    .select()
    .from(customPages)
    .where(and(eq(customPages.id, id), eq(customPages.userId, userId)))
    .get();
}

/** GET /api/pages/:id */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = getOwned(id, session.user.id);
  if (!row) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(toPage(row));
}

/** PATCH /api/pages/:id */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = getOwned(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Partial<typeof customPages.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof body.title === "string") updates.title = body.title;
  if (body.content !== undefined) {
    updates.content = JSON.stringify(body.content);
  }

  db.update(customPages).set(updates).where(eq(customPages.id, id)).run();
  const row = db.select().from(customPages).where(eq(customPages.id, id)).get()!;
  return NextResponse.json(toPage(row));
}

/** DELETE /api/pages/:id */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = getOwned(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  db.delete(customPages).where(eq(customPages.id, id)).run();
  return NextResponse.json({ ok: true });
}
