// 그록봇 상세
import { notFound } from "next/navigation";
import { GrokBotDetail } from "@/components/grok-bots/grok-bot-detail";
import { auth } from "@/lib/auth";
import { rowToGrokBot } from "@/lib/grok-bot";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function GrokBotDetailPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;
  const row = await store.getGrokBot(id, userId);
  if (!row) notFound();

  return <GrokBotDetail bot={rowToGrokBot(row)} />;
}
