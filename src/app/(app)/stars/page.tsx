// GitHub Stars 전용 뷰
import { desc, eq } from "drizzle-orm";
import { StarsView } from "@/components/stars/stars-view";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { githubStars } from "@/lib/db/schema";
import { hasGithubToken } from "@/lib/oauth-tokens";
import type { GithubStar } from "@/lib/types";

export const runtime = "nodejs";

/** Star 목록 서버 로드 후 클라이언트 필터/동기화 UI에 전달 */
export default async function StarsPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const hasGithub =
    Boolean(session?.hasGithub) || hasGithubToken(userId);

  const rows = db
    .select()
    .from(githubStars)
    .where(eq(githubStars.userId, userId))
    .orderBy(desc(githubStars.stars))
    .all();

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
