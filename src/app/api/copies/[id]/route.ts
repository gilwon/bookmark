// 스레드 카피 조회 / 수정 / 삭제
import { NextResponse } from "next/server";
import {
  MAX_COPY_BODY_BYTES,
  MAX_COPY_TAGS,
  MAX_COPY_TITLE_LEN,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { ownershipError, requireUser } from "@/lib/authz";
import { revalidateUserList } from "@/lib/list-cache";
import { store } from "@/lib/store";
import type { ThreadCopyRow } from "@/lib/store/types";
import {
  normalizeSourceUrl,
  parseCopyTags,
  rowToThreadCopy,
  titleFromCopyBody,
} from "@/lib/thread-copy";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const row = await store.getThreadCopy(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(rowToThreadCopy(row));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getThreadCopy(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<ThreadCopyRow> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.body === "string") {
    if (!body.body.trim()) {
      return NextResponse.json(
        { error: "본문을 입력하세요." },
        { status: 400 }
      );
    }
    const limitMsg = overLimitMessage(
      "카피 본문",
      utf8Bytes(body.body),
      MAX_COPY_BODY_BYTES
    );
    if (limitMsg) {
      return NextResponse.json({ error: limitMsg }, { status: 400 });
    }
    patch.body = body.body;
  }

  if (typeof body.title === "string") {
    const title = titleFromCopyBody(
      typeof patch.body === "string" ? patch.body : existing.body,
      body.title
    );
    if (title.length > MAX_COPY_TITLE_LEN) {
      return NextResponse.json(
        { error: `제목은 ${MAX_COPY_TITLE_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.title = title;
  }

  if (body.sourceUrl !== undefined) {
    patch.sourceUrl = normalizeSourceUrl(body.sourceUrl);
  }

  if (body.tags !== undefined) {
    const tags = parseCopyTags(body.tags);
    if (tags.length > MAX_COPY_TAGS) {
      return NextResponse.json(
        { error: `태그는 ${MAX_COPY_TAGS}개 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.tags = JSON.stringify(tags);
  }

  if (typeof body.isFavorite === "boolean") {
    patch.isFavorite = body.isFavorite ? 1 : 0;
  }

  const row = await store.updateThreadCopy(id, gate.user.userId, patch);
  if (!row) return ownershipError();
  revalidateUserList(gate.user.userId, "copies");
  return NextResponse.json(rowToThreadCopy(row));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getThreadCopy(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deleteThreadCopy(id, gate.user.userId);
  revalidateUserList(gate.user.userId, "copies");
  return NextResponse.json({ ok: true });
}
