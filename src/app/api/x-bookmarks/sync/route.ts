// X 북마크 동기화. 만료 토큰은 갱신하고, 응답에 없는 기존 행은 남긴다
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import {
  deleteXToken,
  getXToken,
  hasXAppConfig,
  saveXToken,
} from "@/lib/oauth-tokens";
import { fetchAllBookmarks, getXUserId } from "@/lib/x-api";
import { shouldRefreshAccessToken, type XTokenPayload } from "@/lib/x-bookmarks";
import { refreshAccessToken, XApiError } from "@/lib/x-oauth";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

async function freshToken(
  userId: string,
  current: XTokenPayload
): Promise<XTokenPayload> {
  let next = current;
  if (shouldRefreshAccessToken(current.expiresAt, Date.now())) {
    next = await refreshAccessToken(current);
  }
  if (!next.xUserId) {
    next = { ...next, xUserId: await getXUserId(next.accessToken) };
  }
  if (
    next.accessToken !== current.accessToken ||
    next.refreshToken !== current.refreshToken ||
    next.xUserId !== current.xUserId
  ) {
    await saveXToken(userId, next);
  }
  return next;
}

/** POST /api/x-bookmarks/sync */
export async function POST() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  if (!hasXAppConfig()) {
    return NextResponse.json({ error: "X 앱 키가 없습니다." }, { status: 400 });
  }

  const current = await getXToken(gate.user.userId);
  if (!current) {
    return NextResponse.json(
      { error: "X 연결이 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const token = await freshToken(gate.user.userId, current);
    const items = await fetchAllBookmarks(token.accessToken, token.xUserId);
    const result = await store.upsertXBookmarks(gate.user.userId, items);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[x-bookmarks/sync]", err instanceof Error ? err.message : err);
    const status = err instanceof XApiError ? err.status : 0;
    if (status === 401 || status === 403) {
      await deleteXToken(gate.user.userId);
      return NextResponse.json(
        { error: "X 인증이 만료되었습니다. 다시 연결해 주세요." },
        { status: 401 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "X API 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }
    const detail = err instanceof Error ? err.message : "동기화에 실패했습니다.";
    return NextResponse.json(
      { error: `X 북마크 동기화에 실패했습니다. ${detail}` },
      { status: status || 500 }
    );
  }
}
