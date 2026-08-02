// GitHub Star 설명의 한국어 병기와 서버 번역 API 호출을 관리한다.

const separator = "\n\n";
let warnedMissingKey = false;

export function hasKorean(value: string | null | undefined): boolean {
  return Boolean(value && /[가-힣]/.test(value));
}

export function splitStarDescription(value: string | null | undefined): {
  original: string;
  korean: string | null;
} {
  if (!value?.trim()) return { original: "", korean: null };
  const [original, ...rest] = value.split(separator);
  const korean = rest.join(separator).trim();
  return {
    original: original.trim(),
    korean: hasKorean(korean) ? korean : null,
  };
}

export async function translateToKorean(
  description: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn("[star-translation] OPENAI_API_KEY가 없어 번역을 건너뜁니다.");
      warnedMissingKey = true;
    }
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        store: false,
        instructions:
          "GitHub 저장소 설명을 자연스러운 한국어로 번역하세요. 번역문만 출력하고 설명이나 따옴표는 추가하지 마세요.",
        input: description,
        max_output_tokens: 300,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn(`[star-translation] 번역 API 오류: ${response.status}`);
      return null;
    }

    const body = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };
    const translated =
      body.output_text?.trim() ||
      body.output
        ?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("")
        .trim();

    return translated && hasKorean(translated) ? translated : null;
  } catch (error) {
    console.warn(
      "[star-translation] 번역 API 호출 실패:",
      error instanceof Error ? error.message : "알 수 없는 오류"
    );
    return null;
  }
}

export async function withKoreanTranslation(
  description: string | null,
  previous: string | null
): Promise<string | null> {
  if (!description) return previous;
  if (hasKorean(description)) return description;

  const saved = splitStarDescription(previous);
  if (saved.original === description.trim() && saved.korean) {
    return `${description}\n\n${saved.korean}`;
  }

  const translated = await translateToKorean(description);
  return translated ? `${description}\n\n${translated}` : description;
}
