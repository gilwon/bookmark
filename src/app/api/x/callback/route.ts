// X OAuth 콜백. 코드를 토큰으로 바꾸고 현재 앱 사용자에게 저장한다
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authz";
import { hasXAppConfig, saveXToken } from "@/lib/oauth-tokens";
import { getXUserId } from "@/lib/x-api";
import { appOrigin, exchangeCode, xCallbackUrl } from "@/lib/x-oauth";

export const runtime = "nodejs";

function back(request: NextRequest, query: string) {
  const url = new URL("/x-bookmarks", appOrigin(request));
  url.search = query;
  const res = NextResponse.redirect(url);
  res.cookies.delete("x_oauth_state");
  res.cookies.delete("x_oauth_verifier");
  return res;
}

/** GET /api/x/callback */
export async function GET(request: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    const code = oauthError === "access_denied" ? "denied" : "token";
    return back(request, `error=${code}`);
  }
  if (!hasXAppConfig()) return back(request, "error=config");

  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const stateCookie = request.cookies.get("x_oauth_state")?.value ?? "";
  const verifier = request.cookies.get("x_oauth_verifier")?.value ?? "";
  if (!state || !stateCookie || state !== stateCookie || !verifier) {
    return back(request, "error=state");
  }
  if (!code) return back(request, "error=code");

  try {
    const redirectUri = xCallbackUrl(appOrigin(request));
    const token = await exchangeCode({ code, redirectUri, verifier });
    const xUserId = await getXUserId(token.accessToken);
    await saveXToken(gate.user.userId, { ...token, xUserId });
    return back(request, "connected=1");
  } catch (err) {
    console.error("[x/callback]", err instanceof Error ? err.message : err);
    return back(request, "error=token");
  }
}
