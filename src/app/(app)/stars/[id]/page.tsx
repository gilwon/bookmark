// GitHub Star 상세 페이지.
import { notFound } from "next/navigation";
import { StarDetail } from "@/components/stars/star-detail";
import { auth } from "@/lib/auth";
import { rowToGithubStar } from "@/lib/star-mapper";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function StarDetailPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;
  const row = await store.getStar(id, userId);
  if (!row) notFound();

  return <StarDetail star={rowToGithubStar(row)} />;
}
