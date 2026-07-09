// 에이전트 문서 단건 조회 / 수정 / 삭제 (번들 지원)
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { AgentDocFilePart } from "@/lib/agent-doc-bundle";
import { fieldsFromFiles, rowToAgentDoc } from "@/lib/agent-doc-mapper";
import {
  inferKindFromFilename,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import { ownershipError, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { agentDocs } from "@/lib/db/schema";
import type { AgentDocKind } from "@/lib/types";
import { qget, qrun } from "@/lib/db/query";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const KINDS = new Set<AgentDocKind>(["skill", "agents", "claude", "other"]);

async function getOwned(id: string, userId: string) {
  return await qget(
    db.select().from(agentDocs).where(and(eq(agentDocs.id, id), eq(agentDocs.userId, userId))));
}

/** GET /api/agent-docs/:id */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const row = await getOwned(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(rowToAgentDoc(row));
}

/** PATCH /api/agent-docs/:id */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = await getOwned(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Partial<typeof agentDocs.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  // files 배열이 오면 번들 전체 교체
  if (Array.isArray(body.files)) {
    const files: AgentDocFilePart[] = body.files
      .filter(
        (x): x is { filename: string; content: string } =>
          !!x &&
          typeof x === "object" &&
          typeof (x as { filename?: unknown }).filename === "string" &&
          typeof (x as { content?: unknown }).content === "string"
      )
      .map((x) => ({
        filename: normalizeFilename(x.filename),
        content: x.content,
      }));
    if (files.length > 0) {
      const stored = fieldsFromFiles(files);
      updates.filename = stored.filename;
      updates.content = stored.content;
      updates.bundle = stored.bundle;
      if (files.some((f) => /\.skill$/i.test(f.filename) || /^skill\.md$/i.test(f.filename))) {
        updates.kind = "skill";
      }
    }
  } else {
    if (typeof body.filename === "string" && body.filename.trim()) {
      updates.filename = normalizeFilename(body.filename);
    }
    if (typeof body.content === "string") {
      updates.content = body.content;
    }
    // 단일 content 수정 시 bundle 내 primary 도 맞춤
    if (typeof body.content === "string" || typeof body.filename === "string") {
      const current = rowToAgentDoc(existing);
      const primaryName =
        (updates.filename as string | undefined) ?? current.filename;
      const primaryContent =
        (updates.content as string | undefined) ?? current.content;
      const rest = current.files.filter(
        (f) => f.filename.toLowerCase() !== primaryName.toLowerCase()
      );
      const files = [{ filename: primaryName, content: primaryContent }, ...rest];
      const stored = fieldsFromFiles(files, primaryName);
      updates.filename = stored.filename;
      updates.content = stored.content;
      updates.bundle = stored.bundle;
    }
  }

  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    updates.description = body.description.trim() || null;
  }
  if (typeof body.kind === "string" && KINDS.has(body.kind as AgentDocKind)) {
    updates.kind = body.kind;
  } else if (updates.filename && !updates.kind) {
    updates.kind = inferKindFromFilename(String(updates.filename));
  }

  await qrun(db.update(agentDocs)
    .set(updates)
    .where(
      and(eq(agentDocs.id, id), eq(agentDocs.userId, gate.user.userId))
    ));

  const row = await getOwned(id, gate.user.userId)!;
  return NextResponse.json(rowToAgentDoc(row));
}

/** DELETE /api/agent-docs/:id */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = await getOwned(id, gate.user.userId);
  if (!existing) return ownershipError();

  await qrun(db.delete(agentDocs)
    .where(
      and(eq(agentDocs.id, id), eq(agentDocs.userId, gate.user.userId))
    ));
  return NextResponse.json({ ok: true });
}
