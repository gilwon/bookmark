// GitHub Stars 전용 뷰
import { StarsView } from "@/components/stars/stars-view";
import { auth } from "@/lib/auth";
import { hasGithubToken } from "@/lib/oauth-tokens";
import { store } from "@/lib/store";
import type { GithubStar } from "@/lib/types";

export const runtime = "nodejs";

export default async function StarsPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const hasGithub =
    Boolean(session?.hasGithub) || (await hasGithubToken(userId));

  const rows = await store.listStars(userId);
  const list: GithubStar[] = rows.map((row) => {
    let topics: string[] = [];
    try {
      topics = JSON.parse(row.topics || "[]");
    } catch {
      topics = [];
    }
    return {
      id: row.id,
      userId: row.userId,
      repoFullName: row.repoFullName,
      description: row.description,
      language: row.language,
      stars: row.stars,
      topics,
      url: row.url,
      lastSynced: row.lastSynced,
      createdAt: row.createdAt,
    };
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
