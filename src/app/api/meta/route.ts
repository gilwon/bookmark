// URL 메타 추출 전용 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractMeta } from "@/lib/meta";

export const runtime = "nodejs";

/** POST /api/meta — { url } → 메타 정보 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  let url = body.url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const meta = await extractMeta(url);
  return NextResponse.json(meta);
}
