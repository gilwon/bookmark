// 커스텀 페이지 목록 / 생성 API
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customPages } from "@/lib/db/schema";
import type { CustomPage } from "@/lib/types";
import { qall, qget, qrun } from "@/lib/db/query";

export const runtime = "nodejs";

/** DB 행을 CustomPage로 변환한다. */
function toPage(row: typeof customPages.$inferSelect): CustomPage {
  let content: unknown = {};
  try {
    content = JSON.parse(row.content || "{}");
  } catch {
    content = {};
  }
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** GET /api/pages */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const rows = await qall(db.select().from(customPages)    .where(eq(customPages.userId, session.user.id)).orderBy(desc(customPages.updatedAt)));

  return NextResponse.json(rows.map(toPage));
}

/** POST /api/pages — 새 페이지 생성 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "제목 없는 페이지";

  const emptyDoc = {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
  const content =
    body.content && typeof body.content === "object"
      ? body.content
      : emptyDoc;

  const now = new Date().toISOString();
  const id = uuidv4();

  await qrun(db.insert(customPages)
    .values({
      id,
      userId: session.user.id,
      title,
      content: JSON.stringify(content),
      createdAt: now,
      updatedAt: now,
    }));

  const row = (await qget(db.select().from(customPages).where(eq(customPages.id, id))))!;
  return NextResponse.json(toPage(row), { status: 201 });
}
