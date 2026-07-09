// GitHub Star 목록 / 수동 레포 추가
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import {
  fetchRepoByFullName,
  parseGithubRepoRef,
} from "@/lib/github";
import { getGithubAccessToken } from "@/lib/oauth-tokens";
import { store } from "@/lib/store";
import type { GithubStar } from "@/lib/types";

export const runtime = "nodejs";

function toStar(
  row: Awaited<ReturnType<typeof store.listStars>>[0]
): GithubStar {
  let topics: string[] = [];
  try {
    topics = JSON.parse(row.topics || "[]");
  } catch {
    topics = [];
  }
  return {
    id: row.id,
    userId: row.userId,
    repoFullName: row.repoFullName,
    description: row.description,
    language: row.language,
    stars: row.stars,
    topics,
    url: row.url,
    lastSynced: row.lastSynced,
    createdAt: row.createdAt,
    changeKind: row.changeKind ?? null,
    starsDelta: row.starsDelta ?? 0,
    changedAt: row.changedAt ?? null,
    source: row.source === "manual" ? "manual" : "sync",
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const rows = await store.listStars(session.user.id);
  return NextResponse.json(rows.map(toStar));
}

/**
 * 레포 직접 추가.
 * body: { repo: "owner/repo" | "https://github.com/owner/repo" }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as { repo?: unknown };
  const raw = typeof body.repo === "string" ? body.repo : "";
  const fullName = parseGithubRepoRef(raw);
  if (!fullName) {
    return NextResponse.json(
      {
        error:
          "레포 형식이 올바르지 않습니다. owner/repo 또는 GitHub URL 을 입력하세요.",
      },
      { status: 400 }
    );
  }

  const existing = await store.getStarByRepo(userId, fullName);
  if (existing) {
    return NextResponse.json(
      { error: "이미 목록에 있는 레포입니다.", id: existing.id },
      { status: 409 }
    );
  }

  try {
    const token = await getGithubAccessToken(userId);
    const repo = await fetchRepoByFullName(fullName, token);
    // 대소문자 정규화 후 재확인
    const again = await store.getStarByRepo(userId, repo.repoFullName);
    if (again) {
      return NextResponse.json(
        { error: "이미 목록에 있는 레포입니다.", id: again.id },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    await store.insertStar({
      id,
      userId,
      repoFullName: repo.repoFullName,
      description: repo.description,
      language: repo.language,
      stars: repo.stars,
      topics: JSON.stringify(repo.topics),
      url: repo.url,
      lastSynced: now,
      createdAt: now,
      changeKind: "new",
      starsDelta: 0,
      changedAt: now,
      source: "manual",
    });

    const row = await store.getStar(id, userId);
    if (!row) {
      return NextResponse.json({ error: "저장 후 조회 실패" }, { status: 500 });
    }
    return NextResponse.json(toStar(row), { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "레포 추가 실패";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
