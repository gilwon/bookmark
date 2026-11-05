// eli5 서가 문서 HTML을 로그인한 사용자에게만 내려준다.
import { auth } from "@/lib/auth";
import { buildEli5ShelfDocResponse } from "@/lib/eli5-shelf-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const session = await auth();
  const { id } = await ctx.params;
  return buildEli5ShelfDocResponse({
    id,
    userId: session?.user?.id,
    theme: new URL(req.url).searchParams.get("theme"),
  });
}
