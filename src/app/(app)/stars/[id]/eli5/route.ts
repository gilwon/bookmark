// 등록된 Star의 다섯 살 설명 HTML.
import { auth } from "@/lib/auth";
import { buildStarEli5Html } from "@/lib/star-eli5";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const textHeaders = { "content-type": "text/plain; charset=utf-8" };

/** 로그인한 소유자에게만 다섯 살 설명 문서를 준다. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("인증이 필요합니다.", {
      status: 401,
      headers: textHeaders,
    });
  }

  const { id } = await ctx.params;
  const row = await store.getStar(id, userId);
  if (!row) {
    return new Response("찾을 수 없습니다.", {
      status: 404,
      headers: textHeaders,
    });
  }

  const html = buildStarEli5Html({
    repoFullName: row.repoFullName,
    description: row.description,
    url: row.url,
    detailPath: `/stars/${id}`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      "x-frame-options": "SAMEORIGIN",
      "referrer-policy": "no-referrer",
    },
  });
}
