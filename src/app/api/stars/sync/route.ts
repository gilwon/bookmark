// GitHub Star 동기화 API — 서버 저장 토큰만 사용
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { fetchStarredRepos, upsertStars } from "@/lib/github";
import { getGithubAccessToken } from "@/lib/oauth-tokens";

export const runtime = "nodejs";

/** POST /api/stars/sync */
export async function POST() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const accessToken = await getGithubAccessToken(gate.user.userId);
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "GitHub 로그인이 필요합니다. 로그아웃 후 GitHub로 다시 로그인해 주세요.",
      },
      { status: 400 }
    );
  }

  try {
    const repos = await fetchStarredRepos(accessToken);
    const result = await upsertStars(gate.user.userId, repos);
    return NextResponse.json({
      ok: true,
      count: result.count,
      removed: result.removed,
      lastSynced: result.lastSynced,
      added: result.added,
      updated: result.updated,
      starsChanged: result.starsChanged,
      addedRepos: result.addedRepos.slice(0, 20),
      updatedRepos: result.updatedRepos.slice(0, 20),
      removedRepos: result.removedRepos.slice(0, 20),
    });
  } catch (err) {
    console.error("[stars/sync]", err);
    return NextResponse.json(
      { error: "GitHub Star 동기화에 실패했습니다. 권한 만료 시 재로그인하세요." },
      { status: 500 }
    );
  }
}
