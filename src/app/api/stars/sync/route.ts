// GitHub Star 동기화 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchStarredRepos, upsertStars } from "@/lib/github";

export const runtime = "nodejs";

/** POST /api/stars/sync — JWT access_token으로 starred 목록 upsert */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { error: "GitHub 로그인이 필요합니다" },
      { status: 400 }
    );
  }

  try {
    const repos = await fetchStarredRepos(accessToken);
    const count = await upsertStars(session.user.id, repos);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    console.error("[stars/sync]", err);
    return NextResponse.json(
      { error: "GitHub Star 동기화에 실패했습니다." },
      { status: 500 }
    );
  }
}
