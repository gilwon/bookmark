// 그록봇 목록 / 생성
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  MAX_GROK_BOT_ENTRIES,
  MAX_GROK_BOT_NAME_LEN,
  MAX_GROK_BOT_TEXT_BYTES,
  MAX_GROK_BOT_URL_LEN,
  overLimitMessage,
  utf8Bytes,
} from "@/lib/api-limits";
import { requireUser } from "@/lib/authz";
import {
  GROK_BOTS_TABLE_USER_MESSAGE,
  normalizeTemplateUrl,
  parseGrokBotEntries,
  rowToGrokBot,
  stringifyGrokBotEntries,
} from "@/lib/grok-bot";
import { revalidateUserList } from "@/lib/list-cache";
import { store } from "@/lib/store";

export const runtime = "nodejs";

function clipName(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function textLimit(label: string, value: string): string | null {
  return overLimitMessage(label, utf8Bytes(value), MAX_GROK_BOT_TEXT_BYTES);
}

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const rows = await store.listGrokBots(gate.user.userId);
  return NextResponse.json(rows.map(rowToGrokBot));
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = clipName(body.name);
  if (!name) {
    return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
  }
  if (name.length > MAX_GROK_BOT_NAME_LEN) {
    return NextResponse.json(
      { error: `이름은 ${MAX_GROK_BOT_NAME_LEN}자 이하여야 합니다.` },
      { status: 400 }
    );
  }

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

  const nameEn = clipName(body.nameEn);
  const creator = clipName(body.creator);
  const categoryRaw = clipName(body.category);
  const slugRaw = clipName(body.slug);
  if (
    [nameEn, creator, categoryRaw, slugRaw].some(
      (s) => s.length > MAX_GROK_BOT_NAME_LEN
    )
  ) {
    return NextResponse.json(
      {
        error: `영문명·제작자·카테고리·슬러그는 ${MAX_GROK_BOT_NAME_LEN}자 이하여야 합니다.`,
      },
      { status: 400 }
    );
  }

  const description = typeof body.description === "string" ? body.description : "";
  const howItWorks = typeof body.howItWorks === "string" ? body.howItWorks : "";
  const notes = typeof body.notes === "string" ? body.notes : "";
  for (const [label, value] of [
    ["설명", description],
    ["작동 방식", howItWorks],
    ["메모", notes],
  ] as const) {
    const limitMsg = textLimit(label, value);
    if (limitMsg) {
      return NextResponse.json({ error: limitMsg }, { status: 400 });
    }
  }

  const skills = parseGrokBotEntries(body.skills);
  const routines = parseGrokBotEntries(body.routines);
  if (skills.length > MAX_GROK_BOT_ENTRIES || routines.length > MAX_GROK_BOT_ENTRIES) {
    return NextResponse.json(
      { error: `스킬·루틴은 각각 ${MAX_GROK_BOT_ENTRIES}개 이하여야 합니다.` },
      { status: 400 }
    );
  }

  const sourceUrlRaw =
    typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  if (sourceUrlRaw.length > MAX_GROK_BOT_URL_LEN) {
    return NextResponse.json(
      { error: `원본 URL은 ${MAX_GROK_BOT_URL_LEN}자 이하여야 합니다.` },
      { status: 400 }
    );
  }

  const dup = await store.findGrokBotByTemplateUrl(gate.user.userId, templateUrl);
  if (dup) {
    return NextResponse.json(
      {
        error: "이미 등록된 그록봇입니다.",
        duplicate: true,
        id: dup.id,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  try {
    const row = await store.insertGrokBot({
      id: uuidv4(),
      userId: gate.user.userId,
      slug: slugRaw || null,
      name,
      nameEn,
      creator,
      category: categoryRaw || null,
      description,
      howItWorks,
      notes,
      skills: stringifyGrokBotEntries(skills),
      routines: stringifyGrokBotEntries(routines),
      templateUrl,
      sourceUrl: sourceUrlRaw || null,
      officialMarketplace: body.officialMarketplace === true ? 1 : 0,
      isFavorite: body.isFavorite === true ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
    revalidateUserList(gate.user.userId, "grok-bots");
    return NextResponse.json(rowToGrokBot(row), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === GROK_BOTS_TABLE_USER_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    throw err;
  }
}
