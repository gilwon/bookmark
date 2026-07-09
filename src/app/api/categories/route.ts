// 카테고리 목록 / 생성
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireUser } from "@/lib/authz";
import { store } from "@/lib/store";
import type { Category } from "@/lib/types";

export const runtime = "nodejs";

async function toCategoryList(userId: string): Promise<Category[]> {
  await store.ensureCategoriesFromBookmarks(userId);
  const rows = await store.listCategories(userId);
  const bookmarks = await store.listBookmarks(userId);
  const counts = new Map<string, number>();
  for (const b of bookmarks) {
    const n = b.category?.trim();
    if (!n) continue;
    const k = n.toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return rows
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      count: counts.get(r.name.trim().toLowerCase()) ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const list = await toCategoryList(gate.user.userId);
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
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
  const dup = await store.getCategoryByName(gate.user.userId, name);
  if (dup) {
    return NextResponse.json(
      { error: `이미 있는 카테고리입니다. (${dup.name})`, id: dup.id },
      { status: 409 }
    );
  }
  const now = new Date().toISOString();
  const row = await store.insertCategory({
    id: uuidv4(),
    userId: gate.user.userId,
    name,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json(
    {
      id: row.id,
      userId: row.userId,
      name: row.name,
      count: 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } satisfies Category,
    { status: 201 }
  );
}
