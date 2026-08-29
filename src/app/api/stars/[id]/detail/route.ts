// GitHub Star 상세(레포 메타·README) 조회와 갱신.
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { getGithubAccessToken } from "@/lib/oauth-tokens";
import {
  fetchGithubRepoDetail,
  serializeStarDetailJson,
} from "@/lib/star-detail";
import { rowToGithubStar } from "@/lib/star-mapper";
import { isMostlyKorean } from "@/lib/star-readme-ko";
import { translateReadmeToKorean } from "@/lib/star-readme-translate";
import { withKoreanTranslation } from "@/lib/star-translation";
import { store } from "@/lib/store";
import type { GithubStarRow } from "@/lib/store/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

function isMissingStarDetailColumn(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /detail_json|readme_md_ko|readme_md|detail_fetched_at/i.test(msg);
}

function needsKoreanReadme(
  readmeMd: string | null,
  readmeMdKo: string | null
): boolean {
  if (!readmeMd?.trim()) return false;
  if (isMostlyKorean(readmeMd)) return false;
  if (readmeMdKo && isMostlyKorean(readmeMdKo)) return false;
  return true;
}

async function applyKoreanReadme(
  readmeMd: string | null,
  existingKo: string | null,
  force: boolean
): Promise<string | null> {
  if (!readmeMd?.trim()) return existingKo ?? null;
  if (isMostlyKorean(readmeMd)) return null;
  if (!force && existingKo && isMostlyKorean(existingKo)) return existingKo;
  const ko = await translateReadmeToKorean(readmeMd);
  return ko ?? existingKo ?? null;
}

async function saveStarPatch(
  id: string,
  userId: string,
  row: GithubStarRow,
  patch: Partial<GithubStarRow>,
  cached: boolean
) {
  const merged: GithubStarRow = { ...row, ...patch };
  try {
    await store.updateStar(id, userId, patch);
    const saved = await store.getStar(id, userId);
    if (saved) {
      return NextResponse.json({
        star: rowToGithubStar({ ...saved, ...patch }),
        cached,
      });
    }
    return NextResponse.json({
      star: rowToGithubStar(merged),
      cached,
    });
  } catch (err) {
    if (!isMissingStarDetailColumn(err)) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({
      star: rowToGithubStar(merged),
      cached,
    });
  }
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
    if (needsKoreanReadme(row.readmeMd, row.readmeMdKo)) {
      const readmeMdKo = await applyKoreanReadme(
        row.readmeMd,
        row.readmeMdKo,
        false
      );
      return saveStarPatch(id, userId, row, { readmeMdKo }, true);
    }
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
  const readmeMdKo = await applyKoreanReadme(
    fetched.readmeMd,
    row.readmeMdKo,
    force
  );
  const patch: Partial<GithubStarRow> = {
    detailJson: serializeStarDetailJson(fetched.detail),
    readmeMd: fetched.readmeMd,
    readmeMdKo,
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
  return saveStarPatch(id, userId, row, patch, false);
}
