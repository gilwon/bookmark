// GitHub Star 로컬 삭제
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getStar(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deleteStar(id, gate.user.userId);
  return NextResponse.json({ ok: true });
}
