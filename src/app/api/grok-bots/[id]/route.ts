// 그록봇 조회 / 수정 / 삭제
import { NextResponse } from "next/server";
import {
  MAX_GROK_BOT_ENTRIES,
  MAX_GROK_BOT_NAME_LEN,
  MAX_GROK_BOT_TEXT_BYTES,
  MAX_GROK_BOT_URL_LEN,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { ownershipError, requireUser } from "@/lib/authz";
import {
  GROK_BOTS_TABLE_USER_MESSAGE,
  normalizeTemplateUrl,
  parseGrokBotEntries,
  rowToGrokBot,
  stringifyGrokBotEntries,
} from "@/lib/grok-bot";
import { revalidateUserList } from "@/lib/list-cache";
import { store } from "@/lib/store";
import type { GrokBotRow } from "@/lib/store/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function clipName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim();
}

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const row = await store.getGrokBot(id, gate.user.userId);
  if (!row) return ownershipError();
  return NextResponse.json(rowToGrokBot(row));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getGrokBot(id, gate.user.userId);
  if (!existing) return ownershipError();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<GrokBotRow> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
    }
    if (name.length > MAX_GROK_BOT_NAME_LEN) {
      return NextResponse.json(
        { error: `이름은 ${MAX_GROK_BOT_NAME_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.name = name;
  }

  const nameEn = clipName(body.nameEn);
  if (nameEn !== undefined) {
    if (nameEn.length > MAX_GROK_BOT_NAME_LEN) {
      return NextResponse.json(
        { error: `영문명은 ${MAX_GROK_BOT_NAME_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.nameEn = nameEn;
  }

  const creator = clipName(body.creator);
  if (creator !== undefined) {
    if (creator.length > MAX_GROK_BOT_NAME_LEN) {
      return NextResponse.json(
        { error: `제작자는 ${MAX_GROK_BOT_NAME_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.creator = creator;
  }

  const category = clipName(body.category);
  if (category !== undefined) {
    if (category.length > MAX_GROK_BOT_NAME_LEN) {
      return NextResponse.json(
        { error: `카테고리는 ${MAX_GROK_BOT_NAME_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.category = category || null;
  }

  const slug = clipName(body.slug);
  if (slug !== undefined) {
    if (slug.length > MAX_GROK_BOT_NAME_LEN) {
      return NextResponse.json(
        { error: `슬러그는 ${MAX_GROK_BOT_NAME_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.slug = slug || null;
  }

  if (typeof body.description === "string") {
    const limitMsg = overLimitMessage(
      "설명",
      utf8Bytes(body.description),
      MAX_GROK_BOT_TEXT_BYTES
    );
    if (limitMsg) {
      return NextResponse.json({ error: limitMsg }, { status: 400 });
    }
    patch.description = body.description;
  }

  if (typeof body.howItWorks === "string") {
    const limitMsg = overLimitMessage(
      "작동 방식",
      utf8Bytes(body.howItWorks),
      MAX_GROK_BOT_TEXT_BYTES
    );
    if (limitMsg) {
      return NextResponse.json({ error: limitMsg }, { status: 400 });
    }
    patch.howItWorks = body.howItWorks;
  }

  if (typeof body.notes === "string") {
    const limitMsg = overLimitMessage(
      "메모",
      utf8Bytes(body.notes),
      MAX_GROK_BOT_TEXT_BYTES
    );
    if (limitMsg) {
      return NextResponse.json({ error: limitMsg }, { status: 400 });
    }
    patch.notes = body.notes;
  }

  if (body.skills !== undefined) {
    const skills = parseGrokBotEntries(body.skills);
    if (skills.length > MAX_GROK_BOT_ENTRIES) {
      return NextResponse.json(
        { error: `스킬은 ${MAX_GROK_BOT_ENTRIES}개 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.skills = stringifyGrokBotEntries(skills);
  }

  if (body.routines !== undefined) {
    const routines = parseGrokBotEntries(body.routines);
    if (routines.length > MAX_GROK_BOT_ENTRIES) {
      return NextResponse.json(
        { error: `루틴은 ${MAX_GROK_BOT_ENTRIES}개 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.routines = stringifyGrokBotEntries(routines);
  }

  if (body.templateUrl !== undefined) {
    const templateUrl = normalizeTemplateUrl(body.templateUrl);
    if (!templateUrl) {
      return NextResponse.json(
        { error: "템플릿 URL을 입력하세요." },
        { status: 400 }
      );
    }
    if (templateUrl.length > MAX_GROK_BOT_URL_LEN) {
      return NextResponse.json(
        { error: `템플릿 URL은 ${MAX_GROK_BOT_URL_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    if (normalizeTemplateUrl(existing.templateUrl) !== templateUrl) {
      const dup = await store.findGrokBotByTemplateUrl(
        gate.user.userId,
        templateUrl
      );
      if (dup && dup.id !== id) {
        return NextResponse.json(
          {
            error: "이미 등록된 그록봇입니다.",
            duplicate: true,
            id: dup.id,
          },
          { status: 409 }
        );
      }
    }
    patch.templateUrl = templateUrl;
  }

  if (body.sourceUrl !== undefined) {
    const sourceUrl =
      typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    if (sourceUrl.length > MAX_GROK_BOT_URL_LEN) {
      return NextResponse.json(
        { error: `원본 URL은 ${MAX_GROK_BOT_URL_LEN}자 이하여야 합니다.` },
        { status: 400 }
      );
    }
    patch.sourceUrl = sourceUrl || null;
  }

  if (typeof body.officialMarketplace === "boolean") {
    patch.officialMarketplace = body.officialMarketplace ? 1 : 0;
  }

  if (typeof body.isFavorite === "boolean") {
    patch.isFavorite = body.isFavorite ? 1 : 0;
  }

  try {
    const row = await store.updateGrokBot(id, gate.user.userId, patch);
    if (!row) return ownershipError();
    revalidateUserList(gate.user.userId, "grok-bots");
    return NextResponse.json(rowToGrokBot(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === GROK_BOTS_TABLE_USER_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = await store.getGrokBot(id, gate.user.userId);
  if (!existing) return ownershipError();
  try {
    await store.deleteGrokBot(id, gate.user.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === GROK_BOTS_TABLE_USER_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    throw err;
  }
  revalidateUserList(gate.user.userId, "grok-bots");
  return NextResponse.json({ ok: true });
}
