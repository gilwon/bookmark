// 서버 전용 OAuth 토큰 저장소 (세션/클라이언트에 평문 노출 금지)
import { and, eq } from "drizzle-orm";
import { db, oauthTokens } from "@/lib/db";
import { qget, qrun } from "@/lib/db/query";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

const GITHUB = "github";

/** GitHub access_token을 암호화해 저장(upsert)한다. */
export async function saveGithubToken(
  userId: string,
  accessToken: string
): Promise<void> {
  const now = new Date().toISOString();
  const encrypted = encryptToken(accessToken);
  const existing = await qget(
    db
      .select()
      .from(oauthTokens)
      .where(
        and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, GITHUB))
      )
  );

  if (existing) {
    await qrun(
      db
        .update(oauthTokens)
        .set({ accessTokenEnc: encrypted, updatedAt: now })
        .where(eq(oauthTokens.id, existing.id))
    );
    return;
  }

  await qrun(
    db.insert(oauthTokens).values({
      id: `${userId}:${GITHUB}`,
      userId,
      provider: GITHUB,
      accessTokenEnc: encrypted,
      updatedAt: now,
    })
  );
}

/** 사용자 GitHub 토큰 존재 여부. */
export async function hasGithubToken(userId: string): Promise<boolean> {
  const row = await qget(
    db
      .select({ id: oauthTokens.id })
      .from(oauthTokens)
      .where(
        and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, GITHUB))
      )
  );
  return Boolean(row);
}

/** 복호화된 GitHub access_token. 없으면 null. */
export async function getGithubAccessToken(
  userId: string
): Promise<string | null> {
  const row = await qget(
    db
      .select()
      .from(oauthTokens)
      .where(
        and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, GITHUB))
      )
  );
  if (!row) return null;
  try {
    return decryptToken(row.accessTokenEnc);
  } catch (err) {
    console.error("[oauth-tokens] 복호화 실패", err);
    return null;
  }
}

/** GitHub 토큰 삭제 (로그아웃 등). */
export async function deleteGithubToken(userId: string): Promise<void> {
  await qrun(
    db
      .delete(oauthTokens)
      .where(
        and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, GITHUB))
      )
  );
}
