// 에이전트 문서 목록 / 생성 API
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getAgentDocTemplates,
  inferKindFromFilename,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { agentDocs } from "@/lib/db/schema";
import type { AgentDoc, AgentDocKind } from "@/lib/types";

export const runtime = "nodejs";

const KINDS = new Set<AgentDocKind>(["skill", "agents", "claude", "other"]);

/** DB 행 → AgentDoc */
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

/** GET /api/agent-docs — 현재 사용자 문서 목록 */
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const rows = db
    .select()
    .from(agentDocs)
    .where(eq(agentDocs.userId, gate.user.userId))
    .orderBy(desc(agentDocs.updatedAt))
    .all();

  return NextResponse.json(rows.map(toDoc));
}

/** POST /api/agent-docs — 템플릿 또는 본문으로 생성 */
export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const templates = getAgentDocTemplates();

  // template: "skill" | "agents" | "claude" | "other"
  let filename = "NOTES.md";
  let title = "NOTES.md";
  let description: string | null = null;
  let content = "";
  let kind: AgentDocKind = "other";

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
    }
  }

  if (typeof body.filename === "string" && body.filename.trim()) {
    filename = normalizeFilename(body.filename);
  }
  if (typeof body.title === "string" && body.title.trim()) {
    title = body.title.trim();
  }
  if (typeof body.description === "string") {
    description = body.description.trim() || null;
  }
  if (typeof body.content === "string") {
    content = body.content;
  }
  if (typeof body.kind === "string" && KINDS.has(body.kind as AgentDocKind)) {
    kind = body.kind as AgentDocKind;
  } else {
    kind = inferKindFromFilename(filename);
  }

  const now = new Date().toISOString();
  const id = uuidv4();

  db.insert(agentDocs)
    .values({
      id,
      userId: gate.user.userId,
      kind,
      filename,
      title,
      description,
      content,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const row = db.select().from(agentDocs).where(eq(agentDocs.id, id)).get()!;
  return NextResponse.json(toDoc(row), { status: 201 });
}
