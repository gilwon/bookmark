// 에이전트 문서 목록
import { AgentDocList } from "@/components/agent-docs/agent-doc-list";
import { rowToAgentDoc } from "@/lib/agent-doc-mapper";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export default async function AgentDocsPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const rows = await store.listAgentDocs(userId);
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
