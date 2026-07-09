// GitHub Star 목록 조회 API
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { githubStars } from "@/lib/db/schema";
import type { GithubStar } from "@/lib/types";

export const runtime = "nodejs";

/** DB 행을 GithubStar로 변환한다. */
function toStar(row: typeof githubStars.$inferSelect): GithubStar {
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
}

/** GET /api/stars */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const rows = db
    .select()
    .from(githubStars)
    .where(eq(githubStars.userId, session.user.id))
    .orderBy(desc(githubStars.stars))
    .all();

  return NextResponse.json(rows.map(toStar));
}
