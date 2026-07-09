// 커스텀 페이지 단건
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { store } from "@/lib/store";
import type { CustomPage } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function toPage(row: NonNullable<Awaited<ReturnType<typeof store.getPage>>>): CustomPage {
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

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const row = await store.getPage(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(toPage(row));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getPage(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof body.title === "string") patch.title = body.title;
  if (body.content !== undefined) patch.content = JSON.stringify(body.content);

  const row = await store.updatePage(id, gate.user.userId, patch);
  if (!row) return ownershipError();
  return NextResponse.json(toPage(row));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getPage(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deletePage(id, gate.user.userId);
  return NextResponse.json({ ok: true });
}
