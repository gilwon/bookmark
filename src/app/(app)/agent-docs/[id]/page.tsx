// 에이전트 문서 편집
import { notFound } from "next/navigation";
import { AgentDocEditor } from "@/components/agent-docs/agent-doc-editor";
import { rowToAgentDoc } from "@/lib/agent-doc-mapper";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function AgentDocEditPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;
  const row = await store.getAgentDoc(id, userId);
  if (!row) notFound();
  return <AgentDocEditor mode="edit" doc={rowToAgentDoc(row)} />;
}
