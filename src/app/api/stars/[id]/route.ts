// GitHub Star 로컬 삭제 (동기화 DB 행만 제거, GitHub unstar 아님)
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { githubStars } from "@/lib/db/schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/stars/:id */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = db
    .select()
    .from(githubStars)
    .where(
      and(eq(githubStars.id, id), eq(githubStars.userId, gate.user.userId))
    )
    .get();

  if (!existing) return ownershipError();

  db.delete(githubStars)
    .where(
      and(eq(githubStars.id, id), eq(githubStars.userId, gate.user.userId))
    )
    .run();

  return NextResponse.json({ ok: true });
}
