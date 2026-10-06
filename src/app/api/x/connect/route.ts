// X 계정 연결 시작. PKCE state를 쿠키에 넣고 인가 화면으로 보낸다
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { hasXAppConfig } from "@/lib/oauth-tokens";
import {
  appOrigin,
  buildAuthorizeUrl,
  createOAuthState,
  createPkcePair,
  xCallbackUrl,
} from "@/lib/x-oauth";

export const runtime = "nodejs";

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

/** GET /api/x/connect */
export async function GET(request: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  if (!hasXAppConfig()) {
    return NextResponse.json({ error: "X 앱 키가 없습니다." }, { status: 400 });
  }

  const clientId = process.env.X_CLIENT_ID?.trim() ?? "";
  const { verifier, challenge } = createPkcePair();
  const state = createOAuthState();
  const redirectUri = xCallbackUrl(appOrigin(request));
  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.redirect(
    buildAuthorizeUrl({ clientId, redirectUri, state, challenge })
  );
  res.cookies.set("x_oauth_state", state, { ...COOKIE_BASE, secure });
  res.cookies.set("x_oauth_verifier", verifier, { ...COOKIE_BASE, secure });
  return res;
}
