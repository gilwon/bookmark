// 에이전트 문서 편집
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AgentDocEditor } from "@/components/agent-docs/agent-doc-editor";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agentDocs } from "@/lib/db/schema";
import type { AgentDoc, AgentDocKind } from "@/lib/types";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

const KINDS = new Set<AgentDocKind>(["skill", "agents", "claude", "other"]);

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

  const doc: AgentDoc = {
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
  };

  return <AgentDocEditor doc={doc} />;
}
