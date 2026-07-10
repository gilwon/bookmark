// 커스텀 페이지 목록 / 생성
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  MAX_PAGE_CONTENT_BYTES,
  MAX_PAGE_TITLE_LEN,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import type { CustomPage } from "@/lib/types";

export const runtime = "nodejs";

function toPage(row: Awaited<ReturnType<typeof store.listPages>>[0]): CustomPage {
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const rows = await store.listPages(session.user.id);
  return NextResponse.json(rows.map(toPage));
}

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
  if (title.length > MAX_PAGE_TITLE_LEN) {
    return NextResponse.json(
      { error: `제목은 ${MAX_PAGE_TITLE_LEN}자 이하여야 합니다.` },
      { status: 400 }
    );
  }

  const emptyDoc = {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
  const content =
    body.content && typeof body.content === "object"
      ? body.content
      : emptyDoc;
  const contentStr = JSON.stringify(content);
  const limitMsg = overLimitMessage(
    "페이지 본문",
    utf8Bytes(contentStr),
    MAX_PAGE_CONTENT_BYTES
  );
  if (limitMsg) {
    return NextResponse.json({ error: limitMsg }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = await store.insertPage({
    id: uuidv4(),
    userId: session.user.id,
    title,
    content: JSON.stringify(content),
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(toPage(row), { status: 201 });
}
