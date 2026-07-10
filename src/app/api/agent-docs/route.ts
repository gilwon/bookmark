// 에이전트 문서 목록 / 생성
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import type { AgentDocFilePart } from "@/lib/agent-doc-bundle";
import { pickPrimaryFile } from "@/lib/agent-doc-bundle";
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

  const stored = fieldsFromFiles(files, filename);
  const now = new Date().toISOString();
  const row = await store.insertAgentDoc({
    id: uuidv4(),
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
}
