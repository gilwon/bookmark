// 북마크 목록 조회 / 생성 API
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { categoryFromUrl, extractMeta } from "@/lib/meta";
import { store } from "@/lib/store";
import type { Bookmark } from "@/lib/types";

export const runtime = "nodejs";

function toBookmark(row: Awaited<ReturnType<typeof store.listBookmarks>>[0]): Bookmark {
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

/** GET /api/bookmarks */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const rows = await store.listBookmarks(session.user.id);
  return NextResponse.json(rows.map(toBookmark));
}

/** POST /api/bookmarks */
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
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const tags: string[] = Array.isArray(body.tags)
    ? body.tags.map(String).filter(Boolean)
    : [];
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : categoryFromUrl(url);

  const meta = await extractMeta(url);
  const now = new Date().toISOString();
  const row = await store.insertBookmark({
    id: uuidv4(),
    userId: session.user.id,
    url,
    title: meta.title,
    description: meta.description,
    image: meta.image,
    favicon: meta.favicon,
    tags: JSON.stringify(tags),
    category,
    createdAt: now,
  });

  return NextResponse.json(toBookmark(row), { status: 201 });
}
