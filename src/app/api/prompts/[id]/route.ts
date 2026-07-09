// 프롬프트 조회 / 수정 / 삭제
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { normalizeSections, rowToPrompt } from "@/lib/prompt-mapper";
import { store } from "@/lib/store";
import type { PromptSection } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const row = await store.getPrompt(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(rowToPrompt(row));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getPrompt(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (typeof body.category === "string") {
    patch.category = body.category.trim() || null;
  }
  if (typeof body.summary === "string") {
    patch.summary = body.summary.trim() || null;
  }
  if (typeof body.whenToUse === "string") {
    patch.whenToUse = body.whenToUse.trim() || null;
  }
  if (Array.isArray(body.sections)) {
    const sections: PromptSection[] = normalizeSections(
      body.sections.map((x) => {
        const o = x as { title?: unknown; body?: unknown };
        return {
          title: typeof o.title === "string" ? o.title : "",
          body: typeof o.body === "string" ? o.body : "",
        };
      })
    );
    patch.sections = JSON.stringify(sections);
  }

  const row = await store.updatePrompt(id, gate.user.userId, patch);
  if (!row) return ownershipError();
  return NextResponse.json(rowToPrompt(row));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getPrompt(id, gate.user.userId);
  if (!existing) return ownershipError();
  await store.deletePrompt(id, gate.user.userId);
  return NextResponse.json({ ok: true });
}
