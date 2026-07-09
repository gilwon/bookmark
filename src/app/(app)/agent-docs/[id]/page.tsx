// 에이전트 문서 편집 (번들 탭)
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AgentDocEditor } from "@/components/agent-docs/agent-doc-editor";
import { rowToAgentDoc } from "@/lib/agent-doc-mapper";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agentDocs } from "@/lib/db/schema";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

/** 단건 문서 편집 화면 */
export default async function AgentDocEditPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;

  const row = db
    .select()
    .from(agentDocs)
    .where(and(eq(agentDocs.id, id), eq(agentDocs.userId, userId)))
    .get();

  if (!row) notFound();

  return <AgentDocEditor doc={rowToAgentDoc(row)} />;
}
