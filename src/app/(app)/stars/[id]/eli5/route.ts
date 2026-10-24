// 등록된 Star의 다섯 살 설명 HTML.
import { auth } from "@/lib/auth";
import { buildStarEli5Html, eli5Brief } from "@/lib/star-eli5";
import {
  applyEli5Korean,
  eli5KoreanMarkdown,
  foreignEli5Prose,
  shouldSaveEli5Korean,
  translateEli5Lines,
  withInstallLead,
} from "@/lib/star-eli5-ko";
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

  const source = {
    description: row.description,
    readmeMd: row.readmeMd,
    readmeMdKo: row.readmeMdKo,
    detailFetchedAt: row.detailFetchedAt,
  };
  let brief = eli5Brief(source);
  const foreign = foreignEli5Prose(brief);
  let translated = foreign.length === 0;
  if (foreign.length > 0) {
    const lines = await translateEli5Lines(foreign);
    if (lines) {
      brief = applyEli5Korean(brief, lines);
      translated = true;
    }
  }
  if (translated) {
    brief = { ...brief, install: withInstallLead(brief.install) };
  }
  const html = buildStarEli5Html({
    repoFullName: row.repoFullName,
    url: row.url,
    detailPath: `/stars/${id}`,
    ...source,
    prepared: brief,
  });
  const markdown = eli5KoreanMarkdown(brief);
  if (
    shouldSaveEli5Korean({
      markdown,
      existing: row.readmeMdKo,
      translated,
    })
  ) {
    await store.updateStar(id, userId, { readmeMdKo: markdown }).catch(() => {});
  }

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
