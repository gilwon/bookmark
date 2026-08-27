// GitHub Star 상세(레포 메타·README) 조회와 갱신.
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { getGithubAccessToken } from "@/lib/oauth-tokens";
import {
  fetchGithubRepoDetail,
  serializeStarDetailJson,
} from "@/lib/star-detail";
import { rowToGithubStar } from "@/lib/star-mapper";
import { withKoreanTranslation } from "@/lib/star-translation";
import { store } from "@/lib/store";
import type { GithubStarRow } from "@/lib/store/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function isMissingStarDetailColumn(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /detail_json|readme_md|detail_fetched_at/i.test(msg);
}

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const row = await store.getStar(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json({
    star: rowToGithubStar(row),
    cached: Boolean(row.detailFetchedAt),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const userId = gate.user.userId;
  const row = await store.getStar(id, userId);
  if (!row) return ownershipError();

  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { force?: unknown };
  const force =
    url.searchParams.get("force") === "1" || body.force === true;

  if (row.detailFetchedAt && !force) {
    return NextResponse.json({
      star: rowToGithubStar(row),
      cached: true,
    });
  }

  let fetched: Awaited<ReturnType<typeof fetchGithubRepoDetail>>;
  try {
    const token = await getGithubAccessToken(userId);
    fetched = await fetchGithubRepoDetail(row.repoFullName, token);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "레포 정보를 가져오지 못했습니다.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch: Partial<GithubStarRow> = {
    detailJson: serializeStarDetailJson(fetched.detail),
    readmeMd: fetched.readmeMd,
    detailFetchedAt: now,
    language: fetched.language,
    stars: fetched.stars,
    topics: JSON.stringify(fetched.topics ?? []),
    url: fetched.url || row.url,
    description: withKoreanTranslation(
      row.repoFullName,
      fetched.description,
      row.description
    ),
  };
  const merged: GithubStarRow = { ...row, ...patch };

  try {
    await store.updateStar(id, userId, patch);
    const saved = await store.getStar(id, userId);
    if (saved?.detailFetchedAt) {
      return NextResponse.json({
        star: rowToGithubStar(saved),
        cached: false,
      });
    }
    const overlay = saved ? { ...saved, ...patch } : merged;
    return NextResponse.json({
      star: rowToGithubStar(overlay),
      cached: false,
    });
  } catch (err) {
    if (!isMissingStarDetailColumn(err)) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({
      star: rowToGithubStar(merged),
      cached: false,
    });
  }
}
