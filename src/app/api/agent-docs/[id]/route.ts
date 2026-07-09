// 에이전트 문서 단건 조회 / 수정 / 삭제
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  inferKindFromFilename,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import { ownershipError, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { agentDocs } from "@/lib/db/schema";
import type { AgentDoc, AgentDocKind } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const KINDS = new Set<AgentDocKind>(["skill", "agents", "claude", "other"]);

function toDoc(row: typeof agentDocs.$inferSelect): AgentDoc {
  const kind = KINDS.has(row.kind as AgentDocKind)
    ? (row.kind as AgentDocKind)
    : "other";
  return {
    id: row.id,
    userId: row.userId,
    kind,
    filename: row.filename,
    title: row.title,
    description: row.description,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getOwned(id: string, userId: string) {
  return db
    .select()
    .from(agentDocs)
    .where(and(eq(agentDocs.id, id), eq(agentDocs.userId, userId)))
    .get();
}

/** GET /api/agent-docs/:id */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const row = getOwned(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(toDoc(row));
}

/** PATCH /api/agent-docs/:id */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = getOwned(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = await req.json().catch(() => ({}));
  const updates: Partial<typeof agentDocs.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.filename === "string" && body.filename.trim()) {
    updates.filename = normalizeFilename(body.filename);
  }
  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    updates.description = body.description.trim() || null;
  }
  if (typeof body.content === "string") {
    updates.content = body.content;
  }
  if (typeof body.kind === "string" && KINDS.has(body.kind as AgentDocKind)) {
    updates.kind = body.kind;
  } else if (updates.filename) {
    updates.kind = inferKindFromFilename(updates.filename);
  }

  db.update(agentDocs)
    .set(updates)
    .where(
      and(eq(agentDocs.id, id), eq(agentDocs.userId, gate.user.userId))
    )
    .run();

  const row = getOwned(id, gate.user.userId)!;
  return NextResponse.json(toDoc(row));
}

/** DELETE /api/agent-docs/:id */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = getOwned(id, gate.user.userId);
  if (!existing) return ownershipError();

  db.delete(agentDocs)
    .where(
      and(eq(agentDocs.id, id), eq(agentDocs.userId, gate.user.userId))
    )
    .run();
  return NextResponse.json({ ok: true });
}
