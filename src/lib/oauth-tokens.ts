// 서버 전용 OAuth 토큰 (store 경유 — Supabase JS 또는 SQLite)
import { store } from "@/lib/store";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

const GITHUB = "github";

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
