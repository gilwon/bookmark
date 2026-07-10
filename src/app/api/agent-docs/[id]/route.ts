// 에이전트 문서 단건
import { NextResponse } from "next/server";
import type { AgentDocFilePart } from "@/lib/agent-doc-bundle";
import { fieldsFromFiles, rowToAgentDoc } from "@/lib/agent-doc-mapper";
import {
  inferKindFromFilename,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import {
  MAX_AGENT_DOC_FILES,
  MAX_AGENT_DOC_FILE_BYTES,
  MAX_AGENT_DOC_TOTAL_BYTES,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { ownershipError, requireUser } from "@/lib/authz";
import { store } from "@/lib/store";
import type { AgentDocKind } from "@/lib/types";

function validateAgentFiles(files: AgentDocFilePart[]): string | null {
  if (files.length > MAX_AGENT_DOC_FILES) {
    return `파일은 최대 ${MAX_AGENT_DOC_FILES}개까지입니다.`;
  }
  let total = 0;
  for (const f of files) {
    const n = utf8Bytes(f.content);
    if (n > MAX_AGENT_DOC_FILE_BYTES) {
      return overLimitMessage(
        `파일 ${f.filename}`,
        n,
        MAX_AGENT_DOC_FILE_BYTES
      );
    }
    total += n;
  }
  return overLimitMessage("에이전트 문서 전체", total, MAX_AGENT_DOC_TOTAL_BYTES);
}

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const KINDS = new Set<AgentDocKind>(["skill", "agents", "claude", "other"]);

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const row = await store.getAgentDoc(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(rowToAgentDoc(row));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getAgentDoc(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

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
      const sizeErr = validateAgentFiles(files);
      if (sizeErr) {
        return NextResponse.json({ error: sizeErr }, { status: 400 });
      }
      const stored = fieldsFromFiles(files);
      patch.filename = stored.filename;
      patch.content = stored.content;
      patch.bundle = stored.bundle;
      if (
        files.some(
          (f) =>
            /\.skill$/i.test(f.filename) || /^skill\.md$/i.test(f.filename)
        )
      ) {
        patch.kind = "skill";
      }
    }
  } else {
    if (typeof body.filename === "string" && body.filename.trim()) {
      patch.filename = normalizeFilename(body.filename);
    }
    if (typeof body.content === "string") patch.content = body.content;
    if (typeof body.content === "string" || typeof body.filename === "string") {
      const current = rowToAgentDoc(existing);
      const primaryName =
        (patch.filename as string | undefined) ?? current.filename;
      const primaryContent =
        (patch.content as string | undefined) ?? current.content;
      const rest = current.files.filter(
        (f) => f.filename.toLowerCase() !== primaryName.toLowerCase()
      );
      const files = [
        { filename: primaryName, content: primaryContent },
        ...rest,
      ];
      const sizeErr = validateAgentFiles(files);
      if (sizeErr) {
        return NextResponse.json({ error: sizeErr }, { status: 400 });
      }
      const stored = fieldsFromFiles(files, primaryName);
      patch.filename = stored.filename;
      patch.content = stored.content;
      patch.bundle = stored.bundle;
    }
  }

  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    patch.description = body.description.trim() || null;
  }
  if (typeof body.kind === "string" && KINDS.has(body.kind as AgentDocKind)) {
    patch.kind = body.kind;
  } else if (patch.filename && !patch.kind) {
    patch.kind = inferKindFromFilename(String(patch.filename));
  }

  const row = await store.updateAgentDoc(id, gate.user.userId, patch);
  if (!row) return ownershipError();
  return NextResponse.json(rowToAgentDoc(row));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getAgentDoc(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deleteAgentDoc(id, gate.user.userId);
  return NextResponse.json({ ok: true });
}
