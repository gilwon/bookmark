// 서버 전용 OAuth 토큰 (store 경유 — Supabase JS 또는 SQLite)
import { store } from "@/lib/store";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import {
  parseXTokenPayload,
  serializeXTokenPayload,
  type XTokenPayload,
} from "@/lib/x-bookmarks";

const GITHUB = "github";
const X = "x";

/** GitHub access_token을 암호화해 저장(upsert)한다. */
export async function saveGithubToken(
  userId: string,
  accessToken: string
): Promise<void> {
  const now = new Date().toISOString();
  await store.upsertToken({
    id: `${userId}:${GITHUB}`,
    userId,
    provider: GITHUB,
    accessTokenEnc: encryptToken(accessToken),
    updatedAt: now,
  });
}

/** 사용자 GitHub 토큰 존재 여부. */
export async function hasGithubToken(userId: string): Promise<boolean> {
  const row = await store.getToken(userId, GITHUB);
  return Boolean(row);
}

/** 복호화된 GitHub access_token. 없으면 null. */
export async function getGithubAccessToken(
  userId: string
): Promise<string | null> {
  const row = await store.getToken(userId, GITHUB);
  if (!row) return null;
  try {
    return decryptToken(row.accessTokenEnc);
  } catch (err) {
    console.error("[oauth-tokens] 복호화 실패", err);
    return null;
  }
}

/** GitHub 토큰 삭제. */
export async function deleteGithubToken(userId: string): Promise<void> {
  await store.deleteToken(userId, GITHUB);
}

/** X 개발자 앱 키가 둘 다 있는지. 값은 로그에 남기지 않는다. */
export function hasXAppConfig(): boolean {
  return Boolean(process.env.X_CLIENT_ID?.trim() && process.env.X_CLIENT_SECRET?.trim());
}

/** X 토큰 JSON을 암호화해 저장한다. */
export async function saveXToken(
  userId: string,
  payload: XTokenPayload
): Promise<void> {
  const now = new Date().toISOString();
  await store.upsertToken({
    id: `${userId}:${X}`,
    userId,
    provider: X,
    accessTokenEnc: encryptToken(serializeXTokenPayload(payload)),
    updatedAt: now,
  });
}

/** 사용자 X 토큰이 있고 복호화되면 true. */
export async function hasXToken(userId: string): Promise<boolean> {
  return Boolean(await getXToken(userId));
}

/** 복호화된 X 토큰. 없거나 형식이 깨지면 null. */
export async function getXToken(userId: string): Promise<XTokenPayload | null> {
  const row = await store.getToken(userId, X);
  if (!row) return null;
  try {
    return parseXTokenPayload(decryptToken(row.accessTokenEnc));
  } catch (err) {
    console.error("[oauth-tokens] X 토큰 복호화 실패", err);
    return null;
  }
}

/** X 토큰 삭제. */
export async function deleteXToken(userId: string): Promise<void> {
  await store.deleteToken(userId, X);
}
