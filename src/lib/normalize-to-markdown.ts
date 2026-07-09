// 붙여넣기/Notion 내보내기 HTML·aside 잔여물을 마크다운으로 정리

/** HTML 엔티티 복원 (&lt;aside&gt; 포함) */
export function decodeEntities(s: string): string {
  let out = s;
  // 이중 인코딩 대비 2회
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
        String.fromCharCode(parseInt(h, 16))
      );
  }
  return out;
}

/**
 * HTML 비중이 높은지 대략 판별한다.
 */
export function looksLikeHtml(text: string): boolean {
  if (!text) return false;
  const tags = text.match(/<\/?[a-zA-Z][^>]*>/g);
  if (!tags || tags.length < 2) return false;
  const tagLen = tags.join("").length;
  return tagLen > 30 || tags.length >= 3;
}

/**
 * <aside>…</aside> → :::callout 펜스 (에디터 callout 노드로 복원).
 * 줄바꿈·공백·속성이 있는 태그도 처리.
 */
export function convertAsideBlocks(text: string): string {
  // 닫는 태그가 깨진 경우도 완화: <aside> ... (다음 <aside> 또는 끝까지)
  return text.replace(
    /<aside\b[^>]*>([\s\S]*?)<\s*\/\s*aside\s*>/gi,
    (_m, inner: string) => {
      const body = decodeEntities(
        String(inner)
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<p\b[^>]*>/gi, "")
          .replace(/<\/?div[^>]*>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/\r\n/g, "\n")
          .trim()
      );
      if (!body) return "\n\n";
      return `\n\n:::callout\n${body}\n:::\n\n`;
    }
  );
}

/** 콜아웃 펜스를 임시 플레이스홀더로 보호 */
function protectCalloutFences(text: string): {
  text: string;
  fences: string[];
} {
  const fences: string[] = [];
  const next = text.replace(/:::callout\n[\s\S]*?\n:::/gi, (m) => {
    const i = fences.length;
    fences.push(m);
    return `\n\n%%CALLOUT_${i}%%\n\n`;
  });
  return { text: next, fences };
}

function restoreCalloutFences(text: string, fences: string[]): string {
  return text.replace(/%%CALLOUT_(\d+)%%/g, (_, i) => fences[Number(i)] ?? "");
}

/**
 * 흔한 블록/인라인 HTML → 마크다운 근사 변환.
 */
function simpleHtmlToMarkdown(html: string): string {
  let s = html;

  s = s.replace(
    /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_m, code: string) => {
      const c = decodeEntities(code.replace(/<[^>]+>/g, ""));
      return `\n\n\`\`\`\n${c.trimEnd()}\n\`\`\`\n\n`;
    }
  );
  s = s.replace(
    /<code\b[^>]*>([\s\S]*?)<\/code>/gi,
    (_m, code: string) => `\`${decodeEntities(code.replace(/<[^>]+>/g, ""))}\``
  );

  for (let i = 6; i >= 1; i--) {
    const re = new RegExp(`<h${i}\\b[^>]*>([\\s\\S]*?)<\\/h${i}>`, "gi");
    s = s.replace(re, (_m, inner: string) => {
      const t = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim();
      return `\n\n${"#".repeat(i)} ${t}\n\n`;
    });
  }

  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => {
    const t = decodeEntities(
      inner.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
    ).trim();
    return `\n- ${t}`;
  });
  s = s.replace(/<\/?ul\b[^>]*>/gi, "\n");
  s = s.replace(/<\/?ol\b[^>]*>/gi, "\n");

  s = s.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const t = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim() || href;
      return `[${t}](${href})`;
    }
  );

  s = s.replace(
    /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, inner: string) =>
      `**${decodeEntities(inner.replace(/<[^>]+>/g, "")).trim()}**`
  );
  s = s.replace(
    /<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, inner: string) =>
      `*${decodeEntities(inner.replace(/<[^>]+>/g, "")).trim()}*`
  );

  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<p\b[^>]*>/gi, "");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<div\b[^>]*>/gi, "");
  s = s.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * 붙여넣은 텍스트를 저장용 마크다운으로 정규화한다.
 * - 엔티티 디코드 → aside → :::callout
 * - 기타 HTML → 마크다운
 */
export function normalizePasteToMarkdown(raw: string): string {
  if (!raw?.trim()) return "";

  let text = raw.replace(/\r\n/g, "\n");

  // 1) 엔티티 먼저 (&lt;aside&gt; → <aside>)
  text = decodeEntities(text);

  // 2) aside → callout 펜스
  text = convertAsideBlocks(text);

  // 3) 펜스 보호 후 나머지 HTML 처리
  const protected_ = protectCalloutFences(text);
  text = protected_.text;

  if (looksLikeHtml(text)) {
    text = simpleHtmlToMarkdown(text);
  } else if (/<\/?[a-zA-Z][^>]*>/.test(text)) {
    // 잔여 태그 제거 (펜스는 보호됨)
    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?[a-zA-Z][^>]*>/g, "");
    text = decodeEntities(text);
  }

  text = restoreCalloutFences(text, protected_.fences);
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

/**
 * 문자열에 보이는 aside 태그가 남아 있는지.
 */
export function hasLiteralAside(text: string): boolean {
  const d = decodeEntities(text);
  return /<\s*aside\b/i.test(d) || /<\s*\/\s*aside\s*>/i.test(d);
}
