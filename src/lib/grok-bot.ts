// 그록봇 템플릿 정규화·검색 헬퍼
import type { GrokBot, GrokBotEntry } from "@/lib/types";
import type { GrokBotRow } from "@/lib/store/types";

/** 운영 DB에 테이블이 아직 없을 때 사용자에게 보일 안내. */
export const GROK_BOTS_TABLE_USER_MESSAGE =
  "그록봇 테이블이 없습니다. supabase/add_grok_bots.sql 을 SQL Editor에서 실행하세요.";

/** 목록 칩에 쓰는 기본 카테고리 순서. */
export const GROK_BOT_CATEGORY_ORDER = [
  "공식 마켓플레이스",
  "어시스턴트",
  "엔지니어링",
  "리서치",
  "세일즈·마케팅",
  "금융·비용",
  "크리에이티브",
  "개인·생활",
] as const;

/** PostgREST가 grok_bots 부재를 말할 때 true다. */
export function isMissingGrokBotsTable(message: unknown): boolean {
  const text = String(message ?? "");
  if (!/grok_bots/i.test(text)) return false;
  return /schema cache|does not exist|PGRST205|Could not find the table/i.test(
    text
  );
}

/** trim 후 끝 슬래시를 제거한다. 빈 값은 빈 문자열이다. */
export function normalizeTemplateUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\/+$/, "");
}

/** JSON 문자열·문자열 배열·객체 배열을 엔트리 배열로 만든다. */
export function parseGrokBotEntries(raw: unknown): GrokBotEntry[] {
  let arr: unknown[] = [];
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const v = JSON.parse(s) as unknown;
      if (Array.isArray(v)) arr = v;
      else return [];
    } catch {
      return [];
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    return [];
  }

  const out: GrokBotEntry[] = [];
  for (const item of arr) {
    const parsed = parseOneEntry(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseOneEntry(item: unknown): GrokBotEntry | null {
  if (typeof item === "string") return parseEntryString(item);
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  const descriptionRaw =
    typeof o.descriptionKo === "string"
      ? o.descriptionKo
      : typeof o.description_ko === "string"
        ? o.description_ko
        : "";
  const scheduleRaw = typeof o.schedule === "string" ? o.schedule : "";
  const entry: GrokBotEntry = { name };
  const descriptionKo = descriptionRaw.trim();
  const schedule = scheduleRaw.trim();
  if (descriptionKo) entry.descriptionKo = descriptionKo;
  if (schedule) entry.schedule = schedule;
  return entry;
}

function parseEntryString(raw: string): GrokBotEntry | null {
  const t = raw.trim();
  if (!t) return null;
  let name = t;
  let rest = "";
  const pipeIdx = t.indexOf(" | ");
  const colonIdx = t.indexOf(": ");
  if (pipeIdx > 0) {
    name = t.slice(0, pipeIdx).trim();
    rest = t.slice(pipeIdx + 3).trim();
  } else if (colonIdx > 0) {
    name = t.slice(0, colonIdx).trim();
    rest = t.slice(colonIdx + 2).trim();
  } else if (t.includes("|")) {
    const i = t.indexOf("|");
    name = t.slice(0, i).trim();
    rest = t.slice(i + 1).trim();
  } else if (t.includes(":")) {
    const i = t.indexOf(":");
    name = t.slice(0, i).trim();
    rest = t.slice(i + 1).trim();
  }
  if (!name) return null;
  const entry: GrokBotEntry = { name };
  if (rest) entry.descriptionKo = rest;
  return entry;
}

/** 엔트리 배열을 JSON 문자열로 저장한다. */
export function stringifyGrokBotEntries(entries: GrokBotEntry[]): string {
  return JSON.stringify(
    entries
      .map((e) => {
        const name = e.name.trim();
        if (!name) return null;
        const row: GrokBotEntry = { name };
        const descriptionKo = e.descriptionKo?.trim();
        const schedule = e.schedule?.trim();
        if (descriptionKo) row.descriptionKo = descriptionKo;
        if (schedule) row.schedule = schedule;
        return row;
      })
      .filter((e): e is GrokBotEntry => e != null)
  );
}

/** store 행을 앱 GrokBot 로 변환한다. */
export function rowToGrokBot(row: GrokBotRow): GrokBot {
  const slug = row.slug?.trim() || "";
  const category = row.category?.trim() || "";
  const sourceUrl = row.sourceUrl?.trim() || "";
  return {
    id: row.id,
    userId: row.userId,
    slug: slug || null,
    name: row.name,
    nameEn: row.nameEn ?? "",
    creator: row.creator ?? "",
    category: category || null,
    description: row.description ?? "",
    howItWorks: row.howItWorks ?? "",
    notes: row.notes ?? "",
    skills: parseGrokBotEntries(row.skills),
    routines: parseGrokBotEntries(row.routines),
    templateUrl: row.templateUrl,
    sourceUrl: sourceUrl || null,
    officialMarketplace: Boolean(row.officialMarketplace),
    isFavorite: Boolean(row.isFavorite),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 클라이언트 검색용 평문. */
export function grokBotHaystack(bot: GrokBot): string {
  return [
    bot.name,
    bot.nameEn,
    bot.creator,
    bot.category ?? "",
    bot.description,
    bot.howItWorks,
    bot.templateUrl,
    bot.sourceUrl ?? "",
    bot.slug ?? "",
  ].join(" ");
}
