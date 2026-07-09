// 에이전트 문서 목록 (SKILL.md / AGENTS.md / CLAUDE.md)
import { desc, eq } from "drizzle-orm";
import { AgentDocList } from "@/components/agent-docs/agent-doc-list";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agentDocs } from "@/lib/db/schema";
import type { AgentDoc, AgentDocKind } from "@/lib/types";

export const runtime = "nodejs";

const KINDS = new Set<AgentDocKind>(["skill", "agents", "claude", "other"]);

/** 에이전트 지시 문서 보관함 */
export default async function AgentDocsPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const rows = db
    .select()
    .from(agentDocs)
    .where(eq(agentDocs.userId, userId))
    .orderBy(desc(agentDocs.updatedAt))
    .all();

  const list: AgentDoc[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    kind: KINDS.has(row.kind as AgentDocKind)
      ? (row.kind as AgentDocKind)
      : "other",
    filename: row.filename,
    title: row.title,
    description: row.description,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">에이전트 문서</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SKILL.md, AGENTS.md, CLAUDE.md 등 에이전트 지시문을 저장·편집합니다.
        </p>
      </div>
      <AgentDocList docs={list} />
    </div>
  );
}
