// 커스텀 페이지 단건
import { NextResponse } from "next/server";
import {
  MAX_PAGE_CONTENT_BYTES,
  MAX_PAGE_TITLE_LEN,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { ownershipError, requireUser } from "@/lib/authz";
import { revalidateUserList } from "@/lib/list-cache";
import {
  PAGE_FAVORITE_COLUMN_MISSING,
  PAGE_FAVORITE_COLUMN_USER_MESSAGE,
  isMissingPageFindabilityColumn,
  preparePageFindability,
} from "@/lib/page-findability";
import { store } from "@/lib/store";
import type { CustomPageRow } from "@/lib/store/types";
import type { CustomPage } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

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
    tags: parseTags(row.tags),
    sourceUrl: row.sourceUrl ?? null,
    isFavorite: Boolean(row.isFavorite),
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

  const patch: Partial<CustomPageRow> = {
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
  if (Array.isArray(body.tags)) {
    patch.tags = JSON.stringify(
      body.tags.filter((t: unknown) => typeof t === "string")
    );
  }
  if (body.sourceUrl !== undefined) {
    patch.sourceUrl =
      typeof body.sourceUrl === "string" && body.sourceUrl.trim()
        ? body.sourceUrl.trim()
        : null;
  }
  if (typeof body.isFavorite === "boolean") {
    patch.isFavorite = body.isFavorite ? 1 : 0;
  }

  if (patch.content !== undefined || patch.title !== undefined) {
    let contentUnknown: unknown = body.content;
    if (contentUnknown === undefined) {
      try {
        contentUnknown = JSON.parse(existing.content || "{}");
      } catch {
        contentUnknown = {};
      }
    }
    const existingTags =
      patch.tags !== undefined ? parseTags(patch.tags) : parseTags(existing.tags);
    const existingSourceUrl =
      patch.sourceUrl !== undefined ? patch.sourceUrl : existing.sourceUrl;
    const found = preparePageFindability({
      title: patch.title ?? existing.title,
      content: contentUnknown,
      existingTags,
      existingSourceUrl,
    });
    patch.searchText = found.searchText;
    if (patch.tags === undefined) patch.tags = JSON.stringify(found.tags);
    if (patch.sourceUrl === undefined) patch.sourceUrl = found.sourceUrl;
  }

  try {
    const row = await store.updatePage(id, gate.user.userId, patch);
    if (!row) return ownershipError();
    revalidateUserList(gate.user.userId, "pages");
    return NextResponse.json(toPage(row));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message === PAGE_FAVORITE_COLUMN_MISSING ||
      isMissingPageFindabilityColumn(message)
    ) {
      return NextResponse.json(
        { error: PAGE_FAVORITE_COLUMN_USER_MESSAGE },
        { status: 503 }
      );
    }
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getPage(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deletePage(id, gate.user.userId);
  revalidateUserList(gate.user.userId, "pages");
  return NextResponse.json({ ok: true });
}
