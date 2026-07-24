// GitHub Star 동기화 API — 서버 저장 토큰만 사용
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { fetchStarredRepos, upsertStars } from "@/lib/github";
import { getGithubAccessToken, deleteGithubToken } from "@/lib/oauth-tokens";

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
    // Octokit은 HTTP 오류를 status 필드가 있는 예외로 던진다. 실제 원인별로 분기한다.
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: number }).status
        : undefined;

    if (status === 401) {
      // 토큰이 만료/취소됨 — 저장 토큰을 지워 hasGithub를 리셋하고 재로그인 유도
      await deleteGithubToken(gate.user.userId);
      return NextResponse.json(
        {
          error:
            "GitHub 인증이 만료되었습니다. 로그아웃 후 GitHub로 다시 로그인해 주세요.",
        },
        { status: 401 }
      );
    }
    if (status === 403 || status === 429) {
      return NextResponse.json(
        {
          error:
            "GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 429 }
      );
    }

    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `GitHub Star 동기화에 실패했습니다: ${detail}` },
      { status: 500 }
    );
  }
}
