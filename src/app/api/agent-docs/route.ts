// 에이전트 문서 목록 / 생성
import { NextResponse } from "next/server";
import type { AgentDocFilePart } from "@/lib/agent-doc-bundle";
import { pickPrimaryFile } from "@/lib/agent-doc-bundle";
import {
  agentDocId,
  isDuplicateAgentDoc,
} from "@/lib/agent-doc-dedupe";
import { fieldsFromFiles, rowToAgentDoc } from "@/lib/agent-doc-mapper";
import {
  getAgentDocTemplates,
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
import { requireUser } from "@/lib/authz";
import { store } from "@/lib/store";
import type { AgentDocKind } from "@/lib/types";

/** 파일 배열 크기 검증 */
function validateAgentFiles(
  files: AgentDocFilePart[]
): string | null {
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

const KINDS = new Set<AgentDocKind>(["skill", "agents", "claude", "other"]);

function normalizeFilesInput(body: Record<string, unknown>): AgentDocFilePart[] {
  if (!Array.isArray(body.files)) return [];
  return body.files
    .filter(
      (x): x is AgentDocFilePart =>
        !!x &&
        typeof x === "object" &&
        typeof (x as { filename?: unknown }).filename === "string" &&
        typeof (x as { content?: unknown }).content === "string"
    )
    .map((x) => ({
      filename: normalizeFilename(x.filename),
      content: x.content,
    }));
}

function isUniqueViolation(error: unknown): boolean {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    /UNIQUE constraint failed: agent_docs\.id|duplicate key value violates unique constraint "agent_docs_pkey"/i.test(
      message
    )
  );
}

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const rows = await store.listAgentDocs(gate.user.userId);
  return NextResponse.json(rows.map(rowToAgentDoc));
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const templates = getAgentDocTemplates();

  let filename = "NOTES.md";
  let title = "NOTES.md";
  let description: string | null = null;
  let content = "";
  let kind: AgentDocKind = "other";
  let files: AgentDocFilePart[] = [];

  if (typeof body.template === "string") {
    const tpl =
      templates.find((t) => t.kind === body.template) ??
      templates.find((t) => t.filename === body.template);
    if (tpl) {
      filename = tpl.filename;
      title = tpl.title;
      description = tpl.description;
      content = tpl.content;
      kind = tpl.kind;
      files = [{ filename: tpl.filename, content: tpl.content }];
    }
  }

  const bodyFiles = normalizeFilesInput(body);
  if (bodyFiles.length > 0) {
    files = bodyFiles;
    const primary = pickPrimaryFile(files);
    filename = primary?.filename ?? files[0]!.filename;
    content = primary?.content ?? files[0]!.content;
  } else if (files.length === 0) {
    if (typeof body.filename === "string" && body.filename.trim()) {
      filename = normalizeFilename(body.filename);
    }
    if (typeof body.content === "string") content = body.content;
    files = [{ filename, content }];
  }

  if (typeof body.title === "string" && body.title.trim()) {
    title = body.title.trim();
  } else {
    title = filename.replace(/\.md$/i, "").replace(/\.skill$/i, "") || filename;
  }
  if (typeof body.description === "string") {
    description = body.description.trim() || null;
  }
  if (typeof body.kind === "string" && KINDS.has(body.kind as AgentDocKind)) {
    kind = body.kind as AgentDocKind;
  } else {
    kind = inferKindFromFilename(filename);
    if (files.some((f) => /\.skill$/i.test(f.filename))) kind = "skill";
  }

  const sizeErr = validateAgentFiles(files);
  if (sizeErr) {
    return NextResponse.json({ error: sizeErr }, { status: 400 });
  }

  const existing = await store.listAgentDocs(gate.user.userId, { full: true });
  if (
    isDuplicateAgentDoc(
      files,
      existing.map((row) => rowToAgentDoc(row).files)
    )
  ) {
    return NextResponse.json(
      { error: "이미 등록된 문서입니다." },
      { status: 409 }
    );
  }

  const stored = fieldsFromFiles(files, filename);
  const now = new Date().toISOString();
  let lastInsertError: unknown;
  for (let slot = 0; slot <= existing.length; slot += 1) {
    const id = agentDocId(gate.user.userId, files, slot);
    try {
      const row = await store.insertAgentDoc({
        id,
        userId: gate.user.userId,
        kind,
        filename: stored.filename,
        title,
        description,
        content: stored.content,
        bundle: stored.bundle,
        createdAt: now,
        updatedAt: now,
      });
      return NextResponse.json(rowToAgentDoc(row), { status: 201 });
    } catch (insertError) {
      if (!isUniqueViolation(insertError)) throw insertError;
      lastInsertError = insertError;
      try {
        const collided = await store.getAgentDoc(id, gate.user.userId);
        if (
          collided &&
          isDuplicateAgentDoc(files, [rowToAgentDoc(collided).files])
        ) {
          return NextResponse.json(
            { error: "이미 등록된 문서입니다." },
            { status: 409 }
          );
        }
      } catch {
        throw insertError;
      }
    }
  }
  throw lastInsertError;
}
