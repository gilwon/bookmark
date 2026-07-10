// GitHub access_token AES-256-GCM 암·복호화 (전용 키 또는 AUTH_SECRET)
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const DEV_FALLBACK = "mymark-dev-secret-change-me";

/** 암호화 키 원천 시크릿 (TOKEN_ENCRYPTION_SECRET → AUTH_SECRET) */
function resolveCryptoSecret(): string {
  const secret =
    process.env.TOKEN_ENCRYPTION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;
  const isProd =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (!secret) {
    if (isProd) {
      throw new Error(
        "[token-crypto] TOKEN_ENCRYPTION_SECRET 또는 AUTH_SECRET이 필요합니다."
      );
    }
    return DEV_FALLBACK;
  }
  return secret;
}

/** 시크릿에서 32바이트 키를 유도한다. */
function deriveKey(): Buffer {
  return createHash("sha256").update(resolveCryptoSecret()).digest();
}

/** 평문 토큰을 base64url(iv|tag|ciphertext)로 암호화한다. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

/** encryptToken 결과를 평문으로 복호화한다. */
export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, "base64url");
  if (buf.length < 28) {
    throw new Error("잘못된 암호문 형식");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}
