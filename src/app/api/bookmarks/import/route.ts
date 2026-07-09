// 북마크 HTML 일괄 import API (메타 크롤링 생략 — 속도)
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema";
import { categoryFromUrl } from "@/lib/meta";

export const runtime = "nodejs";

type ImportItem = {
  url: string;
  title?: string;
  category?: string | null;
  tags?: string[];
  addDate?: string | null;
};

const MAX_ITEMS = 5000;

/** POST /api/bookmarks/import — 여러 URL 일괄 저장 */
export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "items 배열이 필요합니다." },
      { status: 400 }
    );
  }

  if (body.items.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_ITEMS}개까지 import 할 수 있습니다.` },
      { status: 400 }
    );
  }

  // 기존 URL 집합 (중복 스킵)
  const existing = db
    .select({ url: bookmarks.url })
    .from(bookmarks)
    .where(eq(bookmarks.userId, gate.user.userId))
    .all();
  const existingUrls = new Set(existing.map((r) => r.url.toLowerCase()));

  let imported = 0;
  let skipped = 0;
  let invalid = 0;
  const now = new Date().toISOString();

  // 트랜잭션으로 일괄 insert
  db.transaction((tx) => {
    for (const raw of body.items as ImportItem[]) {
      if (!raw || typeof raw.url !== "string") {
        invalid += 1;
        continue;
      }
      let url = raw.url.trim();
      if (!url) {
        invalid += 1;
        continue;
      }
      if (!/^https?:\/\//i.test(url)) {
        if (/^\/\//.test(url)) url = `https:${url}`;
        else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
        else {
          // 기타 스킴 스킵
          invalid += 1;
          continue;
        }
      }
      if (!/^https?:\/\//i.test(url)) {
        invalid += 1;
        continue;
      }

      const key = url.toLowerCase();
      if (existingUrls.has(key)) {
        skipped += 1;
        continue;
      }

      let title =
        typeof raw.title === "string" && raw.title.trim()
          ? raw.title.trim()
          : "";
      if (!title) {
        try {
          title = new URL(url).hostname;
        } catch {
          title = url;
        }
      }

      const category =
        typeof raw.category === "string" && raw.category.trim()
          ? raw.category.trim()
          : categoryFromUrl(url);

      const tags = Array.isArray(raw.tags)
        ? raw.tags.map(String).filter(Boolean)
        : [];

      const createdAt =
        typeof raw.addDate === "string" && raw.addDate
          ? raw.addDate
          : now;

      const id = uuidv4();
      tx.insert(bookmarks)
        .values({
          id,
          userId: gate.user.userId,
          url,
          title,
          description: null,
          image: null,
          favicon: null,
          tags: JSON.stringify(tags),
          category,
          createdAt,
        })
        .run();

      existingUrls.add(key);
      imported += 1;
    }
  });

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    invalid,
    total: body.items.length,
  });
}
