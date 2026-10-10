// 다섯 살 설명의 영어 문장을 한국어로 옮긴다.
import type { Eli5Brief, Eli5Chunk } from "./star-eli5";
import { isMostlyKorean } from "./star-readme-ko";

const SECTION_KEYS = ["about", "install", "usage", "pros", "cons"] as const;

type ChatCompletionResponse = {
  choices?: { message?: { content?: unknown } }[];
};

const SYSTEM_PROMPT =
  "영어 문장을 한국어로 옮긴다. 번호와 줄 수를 유지한다. 새 기능이나 평가를 보태지 않는다. 명령, 패키지 이름, 고유명사는 그대로 둔다. 각 줄은 '번호. 문장' 형식만 출력한다.";

/** 아직 한국어가 아닌 설명 문장만 고른다. 명령 코드 블록은 뺀다. */
export function foreignEli5Prose(brief: Eli5Brief): string[] {
  const lines: string[] = [];
  for (const key of SECTION_KEYS) {
    for (const chunk of brief[key]) {
      if (!needsKorean(chunk)) continue;
      lines.push(chunk.text);
    }
  }
  return lines;
}

/** 번역 문장을 원래 칸에 다시 넣는다. */
export function applyEli5Korean(brief: Eli5Brief, translated: string[]): Eli5Brief {
  let index = 0;
  const next = {} as Eli5Brief;
  for (const key of SECTION_KEYS) {
    next[key] = brief[key].map((chunk) => {
      if (!needsKorean(chunk)) return chunk;
      const text = translated[index]?.trim();
      index += 1;
      if (!text) return chunk;
      return { ...chunk, text };
    });
  }
  return next;
}

/** 영어 문장을 실제로 옮긴 뒤에만 한글 README로 저장한다. */
export function shouldSaveEli5Korean(input: {
  markdown: string;
  existing: string | null | undefined;
  translated: boolean;
}): boolean {
  if (!input.translated) return false;
  if (!input.markdown.trim()) return false;
  const prose = input.markdown.replace(/```[\s\S]*?```/g, " ").replace(/^## .+$/gm, " ");
  if (!isMostlyKorean(prose)) return false;
  if (isMostlyKorean(input.existing)) return false;
  return true;
}

/** 설치 명령 앞에 한글 안내를 붙인다. */
export function withInstallLead(chunks: Eli5Chunk[]): Eli5Chunk[] {
  if (!chunks.some((chunk) => chunk.kind === "code")) return chunks;
  if (chunks.some((chunk) => chunk.kind !== "code" && isMostlyKorean(chunk.text))) {
    return chunks;
  }
  return [{ kind: "li", text: "터미널에 아래 명령을 입력합니다." }, ...chunks];
}

/** 한국어 칸을 README 제목으로 저장할 마크다운으로 만든다. */
export function eli5KoreanMarkdown(brief: Eli5Brief): string {
  const blocks: string[] = [];
  pushBlock(blocks, "설치", brief.install);
  pushBlock(blocks, "사용법", brief.usage);
  pushBlock(blocks, "특징", brief.pros);
  pushBlock(blocks, "한계", brief.cons);
  return blocks.join("\n\n");
}

/** 영어 문장 목록을 한국어로 옮긴다. 키가 없거나 실패하면 null. */
export async function translateEli5Lines(
  lines: string[]
): Promise<string[] | null> {
  if (lines.length === 0) return [];
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.6",
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: lines.map((line, index) => `${index + 1}. ${line}`).join("\n"),
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return parseNumbered(content, lines.length);
  } catch {
    return null;
  }
}

function needsKorean(chunk: Eli5Chunk): boolean {
  if (chunk.kind === "code") return false;
  if (isMostlyKorean(chunk.text)) return false;
  return /[A-Za-z]/.test(chunk.text);
}

function pushBlock(blocks: string[], title: string, chunks: Eli5Chunk[]) {
  if (chunks.length === 0) return;
  const body = chunks
    .map((chunk) => {
      if (chunk.kind === "code") {
        return chunk.text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `- \`${line.replace(/`/g, "")}\``)
          .join("\n");
      }
      return `- ${chunk.text}`;
    })
    .join("\n");
  blocks.push(`## ${title}\n${body}`);
}

function parseNumbered(content: string, count: number): string[] | null {
  const out = Array.from({ length: count }, () => "");
  for (const row of content.split("\n")) {
    const match = row.match(/^\s*(\d+)[.)]\s+(.+?)\s*$/);
    if (!match) continue;
    const index = Number(match[1]) - 1;
    if (index < 0 || index >= count || out[index]) continue;
    out[index] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  if (out.some((line) => !line)) return null;
  return out;
}
