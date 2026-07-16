// 프롬프트 목록 / 생성
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  MAX_PROMPT_SECTIONS_BYTES,
  MAX_PROMPT_TITLE_LEN,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { requireUser } from "@/lib/authz";
import { normalizeSections, rowToPrompt } from "@/lib/prompt-mapper";
import { store } from "@/lib/store";
import type { PromptSection } from "@/lib/types";

export const runtime = "nodejs";

function parseSectionsBody(body: Record<string, unknown>): PromptSection[] {
  // 기본 섹션 1개 (필요 시 클라이언트에서 추가)
  if (!Array.isArray(body.sections) || body.sections.length === 0) {
    return [{ title: "1차 프롬프트", body: "" }];
  }
  return normalizeSections(
    body.sections.map((x) => {
      const o = x as { title?: unknown; body?: unknown; content?: unknown };
      return {
        title: typeof o.title === "string" ? o.title : "",
        body: typeof o.body === "string" ? o.body : "",
        content:
          o.content && typeof o.content === "object" ? o.content : undefined,
      };
    })
  );
}

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const rows = await store.listPrompts(gate.user.userId);
  return NextResponse.json(rows.map(rowToPrompt));
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "제목 없는 프롬프트";
  if (title.length > MAX_PROMPT_TITLE_LEN) {
    return NextResponse.json(
      { error: `제목은 ${MAX_PROMPT_TITLE_LEN}자 이하여야 합니다.` },
      { status: 400 }
    );
  }
  const category =
    typeof body.category === "string" ? body.category.trim() || null : null;
  const summary =
    typeof body.summary === "string" ? body.summary.trim() || null : null;
  const whenToUse =
    typeof body.whenToUse === "string" ? body.whenToUse.trim() || null : null;
  const sections = parseSectionsBody(body);
  const sectionsJson = JSON.stringify(sections);
  const limitMsg = overLimitMessage(
    "프롬프트 본문",
    utf8Bytes(sectionsJson),
    MAX_PROMPT_SECTIONS_BYTES
  );
  if (limitMsg) {
    return NextResponse.json({ error: limitMsg }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = await store.insertPrompt({
    id: uuidv4(),
    userId: gate.user.userId,
    title,
    category,
    summary,
    whenToUse,
    sections: sectionsJson,
    isFavorite: 0,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(rowToPrompt(row), { status: 201 });
}
