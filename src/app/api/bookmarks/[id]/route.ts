// 북마크 수정 / 삭제
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const existing = await store.getBookmark(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.category === "string") patch.category = body.category;
  if (Array.isArray(body.tags)) patch.tags = JSON.stringify(body.tags);

  // URL 수정 — 유효한 http(s) 만 허용
  if (typeof body.url === "string") {
    const raw = body.url.trim();
    if (!raw) {
      return NextResponse.json(
        { error: "URL을 입력하세요." },
        { status: 400 }
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return NextResponse.json(
        { error: "올바른 URL 형식이 아닙니다." },
        { status: 400 }
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "http 또는 https URL만 사용할 수 있습니다." },
        { status: 400 }
      );
    }
    patch.url = parsed.toString();
  }

  const row = await store.updateBookmark(id, gate.user.userId, patch);
  if (!row) return ownershipError();

  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch {
    tags = [];
  }

  return NextResponse.json({
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
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getBookmark(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deleteBookmark(id, gate.user.userId);
  return NextResponse.json({ ok: true });
}
