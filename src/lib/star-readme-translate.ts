// Star README를 xAI Chat Completions로 한국어 마크다운으로 옮긴다.
import {
  README_KO_MAX_CHARS,
  extractFencedCode,
  isMostlyKorean,
  restoreFencedCode,
} from "./star-readme-ko";

const SYSTEM_PROMPT =
  "GitHub README 마크다운을 한국어로 옮긴다. 코드 펜스 자리표시(⟦CODE_n⟧), URL, 이미지 경로, 인라인 코드는 그대로 둔다. 제목·목록 구조를 유지한다. 마크다운만 출력한다. 설명 문장이나 인용부호로 감싸지 않는다.";

type ChatCompletionResponse = {
  choices?: { message?: { content?: unknown } }[];
};

/** 영문 README를 한국어로 옮긴다. 키가 없거나 실패하면 null. */
export async function translateReadmeToKorean(
  md: string
): Promise<string | null> {
  if (!md.trim()) return null;
  if (isMostlyKorean(md)) return null;
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const { text, fences } = extractFencedCode(md);
  const truncated = text.length > README_KO_MAX_CHARS;
  const prepared = truncated ? text.slice(0, README_KO_MAX_CHARS) : text;

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
          { role: "user", content: prepared },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(
        "[star-readme] README 한국어 번역 요청이 실패했습니다.",
        res.status
      );
      return null;
    }
    const data = (await res.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      console.warn("[star-readme] README 한국어 번역 응답이 비었습니다.");
      return null;
    }
    let out = restoreFencedCode(content, fences);
    if (truncated) {
      out += "\n\n(앞부분만 한국어로 옮겼습니다.)";
    }
    return out;
  } catch (err) {
    console.warn("[star-readme] README 한국어 번역 중 오류가 났습니다.", err);
    return null;
  }
}
