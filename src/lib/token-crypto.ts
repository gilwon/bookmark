// GitHub access_token AES-256-GCM 암·복호화 (AUTH_SECRET 기반)
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/** AUTH_SECRET에서 32바이트 키를 유도한다. */
function deriveKey(): Buffer {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "mymark-dev-secret-change-me";
  return createHash("sha256").update(secret).digest();
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
