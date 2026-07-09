// GitHub Stars 전용 뷰
import { desc, eq } from "drizzle-orm";
import { StarCard } from "@/components/stars/star-card";
import { SyncButton } from "@/components/stars/sync-button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { githubStars } from "@/lib/db/schema";
import type { GithubStar } from "@/lib/types";

export const runtime = "nodejs";

/** Star 목록과 동기화 버튼을 표시한다. */
export default async function StarsPage() {
  const session = await auth();
  const userId = session!.user!.id;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitHub Stars</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Star한 레포지토리를 동기화해 관리합니다. (GitHub 로그인 필요)
          </p>
        </div>
        <SyncButton />
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          동기화된 Star가 없습니다. GitHub로 로그인한 뒤 동기화 버튼을
          눌러주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <StarCard key={s.id} star={s} />
          ))}
        </div>
      )}
    </div>
  );
}
