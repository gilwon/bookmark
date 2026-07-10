// 커스텀 페이지 단건
import { NextResponse } from "next/server";
import {
  MAX_PAGE_CONTENT_BYTES,
  MAX_PAGE_TITLE_LEN,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { ownershipError, requireUser } from "@/lib/authz";
import { store } from "@/lib/store";
import type { CustomPage } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function toPage(row: NonNullable<Awaited<ReturnType<typeof store.getPage>>>): CustomPage {
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

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const row = await store.getPage(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(toPage(row));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getPage(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = await req.json().catch(() => ({}));

  // 낙관적 잠금 — 클라이언트가 본 버전과 다르면 충돌
  if (
    typeof body.expectedUpdatedAt === "string" &&
    body.expectedUpdatedAt &&
    body.expectedUpdatedAt !== existing.updatedAt
  ) {
    return NextResponse.json(
      {
        error: "다른 저장본과 충돌했습니다. 새로고침 후 다시 시도하세요.",
        conflict: true,
        updatedAt: existing.updatedAt,
      },
      { status: 409 }
    );
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof body.title === "string") {
    const title = body.title.trim() || "제목 없는 페이지";
    if (title.length > MAX_PAGE_TITLE_LEN) {
      return NextResponse.json(
        { error: `제목은 ${MAX_PAGE_TITLE_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.title = title;
  }
  if (body.content !== undefined) {
    const serialized = JSON.stringify(body.content);
    const msg = overLimitMessage(
      "페이지 본문",
      utf8Bytes(serialized),
      MAX_PAGE_CONTENT_BYTES
    );
    if (msg) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    patch.content = serialized;
  }

  const row = await store.updatePage(id, gate.user.userId, patch);
  if (!row) return ownershipError();
  return NextResponse.json(toPage(row));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getPage(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deletePage(id, gate.user.userId);
  return NextResponse.json({ ok: true });
}
