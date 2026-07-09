// GitHub Stars 전용 뷰
import { StarsView } from "@/components/stars/stars-view";
import { auth } from "@/lib/auth";
import { hasGithubToken } from "@/lib/oauth-tokens";
import { rowToGithubStar } from "@/lib/star-mapper";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export default async function StarsPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const hasGithub =
    Boolean(session?.hasGithub) || (await hasGithubToken(userId));

  const rows = await store.listStars(userId);
  const list = rows.map(rowToGithubStar);

  // 변경 있는 항목을 앞으로
  list.sort((a, b) => {
    const aw = a.changeKind ? 1 : 0;
    const bw = b.changeKind ? 1 : 0;
    if (aw !== bw) return bw - aw;
    return (b.stars ?? 0) - (a.stars ?? 0);
  });

  const lastSynced =
    list.reduce<string | null>((acc, s) => {
      if (!acc) return s.lastSynced;
      return Date.parse(s.lastSynced) > Date.parse(acc) ? s.lastSynced : acc;
    }, null) ?? null;

  return (
    <StarsView
      initialStars={list}
      hasGithub={hasGithub}
      lastSynced={lastSynced}
      autoSyncOnEmpty
    />
  );
}
