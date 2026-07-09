// 북마크 수정 / 삭제
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { bookmarkUrlKey, isSameBookmarkUrl } from "@/lib/bookmark-url";
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

  // URL 수정 — 유효한 http(s) 만 허용, 쿼리 제외 중복 금지
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
      parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
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
    const nextUrl = parsed.toString();
    const key = bookmarkUrlKey(nextUrl);
    if (!key) {
      return NextResponse.json(
        { error: "올바른 URL 형식이 아닙니다." },
        { status: 400 }
      );
    }
    // 자기 자신 제외 중복
    if (!isSameBookmarkUrl(existing.url, nextUrl)) {
      const urls = await store.listBookmarkUrls(gate.user.userId);
      const dup = urls.find(
        (u) => u !== existing.url && isSameBookmarkUrl(u, nextUrl)
      );
      if (dup) {
        return NextResponse.json(
          {
            error: `이미 등록된 주소입니다. (쿼리 제외 비교: ${key})`,
            url: dup,
            duplicate: true,
          },
          { status: 409 }
        );
      }
    }
    patch.url = nextUrl;
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
