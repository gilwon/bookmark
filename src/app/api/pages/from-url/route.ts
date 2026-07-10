// URL → 마크다운 본문 추출 API (저장은 클라이언트에서 별도)
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { UnsafeUrlError } from "@/lib/safe-fetch";
import { fetchUrlAsMarkdown } from "@/lib/url-to-markdown";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  try {
    const result = await fetchUrlAsMarkdown(url);
    // partial 스텁도 200 — 클라이언트가 textarea에 채워 편집 가능
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message =
      err instanceof Error ? err.message : "URL 불러오기에 실패했습니다.";
    // undici "fetch failed" 를 그대로 노출하지 않음
    const friendly =
      /fetch failed|redirect count/i.test(message)
        ? `${message} · Notion 앱 링크·로그인 필요 페이지는 본문 추출이 제한됩니다.`
        : message;
    return NextResponse.json({ error: friendly }, { status: 422 });
  }
}
