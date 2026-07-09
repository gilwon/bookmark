// URL → 마크다운 본문 추출 API (저장은 클라이언트에서 별도)
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
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
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "URL 불러오기에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
