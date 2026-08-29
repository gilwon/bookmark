// README 한국어 여부 판별과 코드 펜스 자리표시를 담당한다.

export const README_KO_MAX_CHARS = 20_000;

const HANGUL_RE = /[가-힣]/g;
const LETTER_RE = /[A-Za-z가-힣]/g;
const FENCE_RE = /```[\s\S]*?```/g;

/** 한글 글자 비율로 README가 한국어인지 판별한다. */
export function isMostlyKorean(value: string | null | undefined): boolean {
  if (!value) return false;
  const hangul = value.match(HANGUL_RE)?.length ?? 0;
  const letters = value.match(LETTER_RE)?.length ?? 0;
  if (hangul >= 80) return true;
  return letters > 0 && hangul / letters >= 0.15;
}

/** 펜스 코드 블록을 자리표시로 빼 둔다. */
export function extractFencedCode(md: string): {
  text: string;
  fences: string[];
} {
  const fences: string[] = [];
  const text = md.replace(FENCE_RE, (block) => {
    const i = fences.length;
    fences.push(block);
    return `⟦CODE_${i}⟧`;
  });
  return { text, fences };
}

/** 자리표시를 원래 펜스 코드로 되돌린다. */
export function restoreFencedCode(text: string, fences: string[]): string {
  return fences.reduce(
    (acc, block, i) => acc.replaceAll(`⟦CODE_${i}⟧`, () => block),
    text
  );
}
