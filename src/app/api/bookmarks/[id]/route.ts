// 북마크 수정 / 삭제
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = await store.getBookmark(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.category === "string") patch.category = body.category;
  if (Array.isArray(body.tags)) patch.tags = JSON.stringify(body.tags);

  const row = await store.updateBookmark(id, gate.user.userId, patch);
  if (!row) return ownershipError();

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

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getBookmark(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deleteBookmark(id, gate.user.userId);
  return NextResponse.json({ ok: true });
}
