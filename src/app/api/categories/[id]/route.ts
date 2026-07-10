// 카테고리 수정 / 삭제
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getCategory(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "카테고리 이름을 입력하세요." },
      { status: 400 }
    );
  }
  if (name === "미분류") {
    return NextResponse.json(
      { error: "「미분류」는 예약된 이름입니다." },
      { status: 400 }
    );
  }

  const clash = await store.getCategoryByName(gate.user.userId, name);
  if (clash && clash.id !== id) {
    return NextResponse.json(
      { error: `이미 있는 카테고리입니다. (${clash.name})` },
      { status: 409 }
    );
  }

  const oldName = existing.name;
  const now = new Date().toISOString();

  // 북마크 문자열을 먼저 배치 갱신한 뒤 마스터 이름 변경 (중간 불일치 최소화)
  if (oldName.trim() !== name) {
    await store.renameBookmarkCategory(gate.user.userId, oldName, name);
  }

  const row = await store.updateCategory(id, gate.user.userId, {
    name,
    updatedAt: now,
  });
  if (!row) return ownershipError();

  const bookmarks = await store.listBookmarks(gate.user.userId);
  const count = bookmarks.filter(
    (b) => (b.category ?? "").trim().toLowerCase() === name.toLowerCase()
  ).length;

  return NextResponse.json({
    id: row.id,
    userId: row.userId,
    name: row.name,
    count,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getCategory(id, gate.user.userId);
  if (!existing) return ownershipError();

  // 해당 카테고리 북마크는 미분류(null)로
  await store.renameBookmarkCategory(
    gate.user.userId,
    existing.name,
    null
  );
  await store.deleteCategory(id, gate.user.userId);
  return NextResponse.json({ ok: true });
}
