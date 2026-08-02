// GitHub Star 설명의 정적 한국어 번역과 병기 처리를 관리한다.
import translations from "../data/star-descriptions-ko.json" with { type: "json" };

const separator = "\n\n";

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

export function withKoreanTranslation(
  repoFullName: string,
  description: string | null,
  previous: string | null
): string | null {
  if (!description) return previous;
  if (hasKorean(description)) return description;

  const saved = splitStarDescription(previous);
  if (saved.original === description.trim() && saved.korean) {
    return `${description}\n\n${saved.korean}`;
  }

  const translation = translations[repoFullName as keyof typeof translations];
  return translation ? `${description}\n\n${translation}` : description;
}
