// 북마크 목록 조회 / 생성 API
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema";
import { categoryFromUrl, extractMeta } from "@/lib/meta";
import type { Bookmark } from "@/lib/types";
import { qall, qget, qrun } from "@/lib/db/query";

export const runtime = "nodejs";

/** DB 행을 API 응답용 Bookmark로 변환한다. */
function toBookmark(row: typeof bookmarks.$inferSelect): Bookmark {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    userId: row.userId,
    url: row.url,
    title: row.title,
    description: row.description,
    image: row.image,
    favicon: row.favicon,
    tags,
    category: row.category,
    createdAt: row.createdAt,
  };
}

/** GET /api/bookmarks — 현재 사용자 북마크 목록 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const rows = await qall(db.select().from(bookmarks)    .where(eq(bookmarks.userId, session.user.id)).orderBy(desc(bookmarks.createdAt)));

  return NextResponse.json(rows.map(toBookmark));
}

/** POST /api/bookmarks — 메타 추출 후 북마크 생성 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  let url = body.url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const tags: string[] = Array.isArray(body.tags)
    ? body.tags.map(String).filter(Boolean)
    : [];
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : categoryFromUrl(url);

  const meta = await extractMeta(url);
  const now = new Date().toISOString();
  const id = uuidv4();

  await qrun(db.insert(bookmarks)
    .values({
      id,
      userId: session.user.id,
      url,
      title: meta.title,
      description: meta.description,
      image: meta.image,
      favicon: meta.favicon,
      tags: JSON.stringify(tags),
      category,
      createdAt: now,
    }));

  const row = (await qget(db.select().from(bookmarks).where(eq(bookmarks.id, id))))!;
  return NextResponse.json(toBookmark(row), { status: 201 });
}
