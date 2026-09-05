// 스레드 카피 목록 / 생성
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  MAX_COPY_BODY_BYTES,
  MAX_COPY_TAGS,
  MAX_COPY_TITLE_LEN,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { requireUser } from "@/lib/authz";
import { revalidateUserList } from "@/lib/list-cache";
import { store } from "@/lib/store";
import {
  THREAD_COPIES_TABLE_USER_MESSAGE,
  normalizeSourceUrl,
  parseCopyTags,
  rowToThreadCopy,
  titleFromCopyBody,
} from "@/lib/thread-copy";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const rows = await store.listThreadCopies(gate.user.userId);
  return NextResponse.json(rows.map(rowToThreadCopy));
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const bodyText = typeof body.body === "string" ? body.body : "";
  if (!bodyText.trim()) {
    return NextResponse.json(
      { error: "본문을 입력하세요." },
      { status: 400 }
    );
  }
  const limitMsg = overLimitMessage(
    "카피 본문",
    utf8Bytes(bodyText),
    MAX_COPY_BODY_BYTES
  );
  if (limitMsg) {
    return NextResponse.json({ error: limitMsg }, { status: 400 });
  }

  const title = titleFromCopyBody(
    bodyText,
    typeof body.title === "string" ? body.title : undefined
  );
  if (title.length > MAX_COPY_TITLE_LEN) {
    return NextResponse.json(
      { error: `제목은 ${MAX_COPY_TITLE_LEN}자 이하여야 합니다.` },
      { status: 400 }
    );
  }

  const tags = parseCopyTags(body.tags);
  if (tags.length > MAX_COPY_TAGS) {
    return NextResponse.json(
      { error: `태그는 ${MAX_COPY_TAGS}개 이하여야 합니다.` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  try {
    const row = await store.insertThreadCopy({
      id: uuidv4(),
      userId: gate.user.userId,
      title,
      body: bodyText,
      sourceUrl: normalizeSourceUrl(body.sourceUrl),
      tags: JSON.stringify(tags),
      isFavorite: body.isFavorite === true ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
    revalidateUserList(gate.user.userId, "copies");
    return NextResponse.json(rowToThreadCopy(row), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === THREAD_COPIES_TABLE_USER_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    throw err;
  }
}
