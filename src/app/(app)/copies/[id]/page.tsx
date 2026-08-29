// 스레드 카피 상세
import { notFound } from "next/navigation";
import { CopyDetail } from "@/components/copies/copy-detail";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { rowToThreadCopy } from "@/lib/thread-copy";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function CopyDetailPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;
  const row = await store.getThreadCopy(id, userId);
  if (!row) notFound();

  return <CopyDetail copy={rowToThreadCopy(row)} />;
}
