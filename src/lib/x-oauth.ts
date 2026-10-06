// X OAuth 2.0 PKCE. 앱 로그인과 분리된 계정 연결
import { createHash, randomBytes } from "node:crypto";
import { X_SCOPES, type XTokenPayload } from "@/lib/x-bookmarks";

export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";

const DEFAULT_EXPIRES_SEC = 7200;

export class XApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "XApiError";
    this.status = status;
  }
}

/** 설정된 공개 origin. 없으면 요청 origin. */
export function resolveAppOrigin(input: {
  configured?: string | null;
  requestOrigin?: string | null;
}): string {
  const configured = input.configured?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const requestOrigin = input.requestOrigin?.trim();
  if (requestOrigin) return requestOrigin.replace(/\/$/, "");
  return "http://localhost:3000";
}

/** 요청에서 콜백에 쓸 origin을 고른다. */
export function appOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  let requestOrigin: string | null = null;
  if (forwardedHost) {
    const proto = (forwardedProto ?? "https").split(",")[0].trim();
    const host = forwardedHost.split(",")[0].trim();
    requestOrigin = `${proto}://${host}`;
  } else {
    requestOrigin = new URL(request.url).origin;
  }
  return resolveAppOrigin({
    configured: process.env.AUTH_URL || process.env.NEXTAUTH_URL,
    requestOrigin,
  });
}

/** OAuth 콜백 주소. */
export function xCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/x/callback`;
}

/** PKCE verifier와 S256 challenge. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** CSRF state. */
export function createOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/** 사용자에게 보낼 인가 URL. */
export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(X_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", X_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.X_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.X_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) {
    throw new XApiError(400, "X 앱 키가 없습니다.");
  }
  return { clientId, clientSecret };
}

async function readXError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as {
      error_description?: unknown;
      detail?: unknown;
      title?: unknown;
      error?: unknown;
      access_token?: unknown;
      refresh_token?: unknown;
    };
    if ("access_token" in json || "refresh_token" in json) {
      return `X 요청이 실패했습니다. (${res.status})`;
    }
    const detail =
      json.error_description ?? json.detail ?? json.title ?? json.error;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim().slice(0, 180);
    }
  } catch {
    // 본문이 JSON이 아니면 상태 코드만 알린다.
  }
  return `X 요청이 실패했습니다. (${res.status})`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

/** 인가 코드 또는 리프레시 토큰을 액세스 토큰으로 바꾼다. */
async function postToken(
  body: URLSearchParams,
  previous: XTokenPayload | null
): Promise<XTokenPayload> {
  const { clientId, clientSecret } = clientCredentials();
  body.set("client_id", clientId);
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new XApiError(res.status, await readXError(res));
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) {
    throw new XApiError(502, "X 액세스 토큰이 응답에 없습니다.");
  }
  const expiresIn =
    typeof json.expires_in === "number" && json.expires_in > 0
      ? json.expires_in
      : DEFAULT_EXPIRES_SEC;
  const refreshToken = json.refresh_token || previous?.refreshToken || "";
  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    xUserId: previous?.xUserId ?? "",
  };
}

/** 인가 코드를 토큰으로 교환한다. */
export async function exchangeCode(input: {
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<XTokenPayload> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier,
  });
  return postToken(body, null);
}

/** 리프레시 토큰으로 액세스를 갱신한다. 새 리프레시가 없으면 기존 값을 유지한다. */
export async function refreshAccessToken(
  current: XTokenPayload
): Promise<XTokenPayload> {
  if (!current.refreshToken) {
    throw new XApiError(401, "X 리프레시 토큰이 없습니다.");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refreshToken,
  });
  const next = await postToken(body, current);
  return { ...next, xUserId: current.xUserId };
}
