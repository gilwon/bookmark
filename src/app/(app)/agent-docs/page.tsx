// 에이전트 문서 목록 (SKILL.md / AGENTS.md / CLAUDE.md / .skill 번들)
import { desc, eq } from "drizzle-orm";
import { AgentDocList } from "@/components/agent-docs/agent-doc-list";
import { rowToAgentDoc } from "@/lib/agent-doc-mapper";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agentDocs } from "@/lib/db/schema";

export const runtime = "nodejs";

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

  const list = rows.map(rowToAgentDoc);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">에이전트 문서</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SKILL.md, AGENTS.md, CLAUDE.md, .skill 파일을 저장합니다. skill.md 와
          .skill 을 함께 올리면 한 번들로 묶입니다.
        </p>
      </div>
      <AgentDocList docs={list} />
    </div>
  );
}
