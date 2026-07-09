// 서버 전용 OAuth 토큰 저장소 (세션/클라이언트에 평문 노출 금지)
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

const GITHUB = "github";

/** GitHub access_token을 암호화해 저장(upsert)한다. */
export function saveGithubToken(userId: string, accessToken: string): void {
  const now = new Date().toISOString();
  const encrypted = encryptToken(accessToken);
  const existing = db
    .select()
    .from(oauthTokens)
    .where(
      and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, GITHUB))
    )
    .get();

  if (existing) {
    db.update(oauthTokens)
      .set({ accessTokenEnc: encrypted, updatedAt: now })
      .where(eq(oauthTokens.id, existing.id))
      .run();
    return;
  }

  db.insert(oauthTokens)
    .values({
      id: `${userId}:${GITHUB}`,
      userId,
      provider: GITHUB,
      accessTokenEnc: encrypted,
      updatedAt: now,
    })
    .run();
}

/** 사용자 GitHub 토큰 존재 여부. */
export function hasGithubToken(userId: string): boolean {
  const row = db
    .select({ id: oauthTokens.id })
    .from(oauthTokens)
    .where(
      and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, GITHUB))
    )
    .get();
  return Boolean(row);
}

/** 복호화된 GitHub access_token. 없으면 null. */
export function getGithubAccessToken(userId: string): string | null {
  const row = db
    .select()
    .from(oauthTokens)
    .where(
      and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, GITHUB))
    )
    .get();
  if (!row) return null;
  try {
    return decryptToken(row.accessTokenEnc);
  } catch (err) {
    console.error("[oauth-tokens] 복호화 실패", err);
    return null;
  }
}

/** GitHub 토큰 삭제 (로그아웃 등). */
export function deleteGithubToken(userId: string): void {
  db.delete(oauthTokens)
    .where(
      and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, GITHUB))
    )
    .run();
}
