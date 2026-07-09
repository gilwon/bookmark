// 커스텀 페이지 단건 조회 / 수정 / 삭제 — user_id 소유권 필수
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
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

/** 소유자 페이지 조회 */
function getOwned(id: string, userId: string) {
  return db
    .select()
    .from(customPages)
    .where(and(eq(customPages.id, id), eq(customPages.userId, userId)))
    .get();
}

/** GET /api/pages/:id */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const row = getOwned(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(toPage(row));
}

/** PATCH /api/pages/:id */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = getOwned(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = await req.json().catch(() => ({}));
  const updates: Partial<typeof customPages.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof body.title === "string") updates.title = body.title;
  if (body.content !== undefined) {
    updates.content = JSON.stringify(body.content);
  }

  db.update(customPages)
    .set(updates)
    .where(
      and(eq(customPages.id, id), eq(customPages.userId, gate.user.userId))
    )
    .run();

  const row = getOwned(id, gate.user.userId)!;
  return NextResponse.json(toPage(row));
}

/** DELETE /api/pages/:id */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = getOwned(id, gate.user.userId);
  if (!existing) return ownershipError();

  db.delete(customPages)
    .where(
      and(eq(customPages.id, id), eq(customPages.userId, gate.user.userId))
    )
    .run();
  return NextResponse.json({ ok: true });
}
