// 본문 평문에서 http(s) URL을 링크 조각으로 나눈다

export type LinkifyPart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; value: string };

/** 링크 끝에서 항상 떼는 문장부호. */
const TRAILING_MARKS = new Set([
  ".",
  ",",
  ";",
  ":",
  "!",
  "?",
  "…",
  "，",
  "。",
  "、",
  ">",
  "」",
  "』",
  "】",
]);

/** 짝이 안 맞을 때만 끝에서 떼는 닫는 괄호와 여는 짝. */
const TRAILING_CLOSERS: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
  "）": "（",
};

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

/** href가 http(s)일 때만 통과한다. */
function isHttpUrl(href: string): boolean {
  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function stripTrailingPunct(token: string): string {
  let end = token.length;
  while (end > 0) {
    const ch = token[end - 1]!;
    if (TRAILING_MARKS.has(ch)) {
      end -= 1;
      continue;
    }
    const open = TRAILING_CLOSERS[ch];
    if (open) {
      let balance = 0;
      for (let i = 0; i < end; i += 1) {
        const c = token[i]!;
        if (c === open) balance += 1;
        else if (c === ch) balance -= 1;
      }
      if (balance < 0) {
        end -= 1;
        continue;
      }
    }
    break;
  }
  return token.slice(0, end);
}

function startsHttp(text: string, i: number): boolean {
  return text.startsWith("https://", i) || text.startsWith("http://", i);
}

function startsWww(text: string, i: number): boolean {
  return text.startsWith("www.", i);
}

/** 바로 앞이 영숫자면 URL 접두어로 보지 않는다. */
function canStartUrl(text: string, i: number): boolean {
  if (i === 0) return true;
  return !/[A-Za-z0-9]/.test(text[i - 1]!);
}

function matchMarkdown(
  text: string,
  i: number
): { length: number; href: string; value: string } | null {
  if (text[i] !== "[") return null;
  const closeLabel = text.indexOf("]", i + 1);
  if (closeLabel < 0) return null;
  if (text[closeLabel + 1] !== "(") return null;
  const label = text.slice(i + 1, closeLabel);
  if (!label) return null;
  const urlStart = closeLabel + 2;
  if (!startsHttp(text, urlStart)) return null;

  let depth = 1;
  let u = urlStart;
  while (u < text.length && depth > 0) {
    const c = text[u]!;
    if (isWhitespace(c)) break;
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    u += 1;
  }
  if (depth !== 0) return null;
  const href = text.slice(urlStart, u - 1);
  if (!href || !isHttpUrl(href)) return null;
  return { length: u - i, href, value: label };
}

function matchRawUrl(
  text: string,
  i: number
): { length: number; href: string; value: string } | null {
  if (!canStartUrl(text, i)) return null;
  const isWww = startsWww(text, i);
  if (!startsHttp(text, i) && !isWww) return null;

  let j = i;
  while (j < text.length && !isWhitespace(text[j]!)) j += 1;
  const core = stripTrailingPunct(text.slice(i, j));
  if (!core || (isWww && core === "www.")) return null;
  const href = isWww ? `https://${core}` : core;
  if (!isHttpUrl(href)) return null;
  return { length: core.length, href, value: core };
}

export function splitLinkifyParts(text: string): LinkifyPart[] {
  if (text === "") return [];

  const parts: LinkifyPart[] = [];
  let i = 0;
  let textStart = 0;

  const flushText = (end: number) => {
    if (end > textStart) {
      parts.push({ type: "text", value: text.slice(textStart, end) });
    }
  };

  while (i < text.length) {
    const md = matchMarkdown(text, i);
    if (md) {
      flushText(i);
      parts.push({ type: "link", href: md.href, value: md.value });
      i += md.length;
      textStart = i;
      continue;
    }
    const raw = matchRawUrl(text, i);
    if (raw) {
      flushText(i);
      parts.push({ type: "link", href: raw.href, value: raw.value });
      i += raw.length;
      textStart = i;
      continue;
    }
    i += 1;
  }

  flushText(text.length);
  return parts;
}
