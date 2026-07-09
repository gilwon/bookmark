// 붙여넣기/Notion 내보내기 HTML 잔여물을 마크다운으로 정리

/**
 * HTML 비중이 높은지 대략 판별한다.
 */
export function looksLikeHtml(text: string): boolean {
  if (!text) return false;
  const tags = text.match(/<\/?[a-zA-Z][^>]*>/g);
  if (!tags || tags.length < 2) return false;
  // 태그 길이가 전체의 일정 비율 이상이면 HTML로 본다
  const tagLen = tags.join("").length;
  return tagLen > 30 || tags.length >= 3;
}

/** HTML 엔티티 최소 복원 */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Notion/복사본에 흔한 <aside> 콜아웃 → 마크다운 인용.
 * 예: <aside>💡 설명</aside> → > 💡 설명
 */
function convertAsideBlocks(text: string): string {
  return text.replace(
    /<aside\b[^>]*>([\s\S]*?)<\/aside>/gi,
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
      if (!body) return "";
      const quoted = body
        .split("\n")
        .map((line) => `> ${line.trimEnd()}`)
        .join("\n");
      return `\n\n${quoted}\n\n`;
    }
  );
}

/**
 * 흔한 블록/인라인 HTML → 마크다운 근사 변환 (브라우저 없이).
 */
function simpleHtmlToMarkdown(html: string): string {
  let s = html;

  // 코드 블록 먼저
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

  // 제목
  for (let i = 6; i >= 1; i--) {
    const re = new RegExp(
      `<h${i}\\b[^>]*>([\\s\\S]*?)<\\/h${i}>`,
      "gi"
    );
    s = s.replace(re, (_m, inner: string) => {
      const t = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim();
      return `\n\n${"#".repeat(i)} ${t}\n\n`;
    });
  }

  // 리스트
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => {
    const t = decodeEntities(
      inner.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
    ).trim();
    return `\n- ${t}`;
  });
  s = s.replace(/<\/?ul\b[^>]*>/gi, "\n");
  s = s.replace(/<\/?ol\b[^>]*>/gi, "\n");

  // 링크
  s = s.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const t = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim() || href;
      return `[${t}](${href})`;
    }
  );

  // 강조
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

  // 단락/줄바꿈
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<p\b[^>]*>/gi, "");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<div\b[^>]*>/gi, "");
  s = s.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  // 남은 태그 제거
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);

  // 공백 정리
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * 붙여넣은 텍스트를 저장용 마크다운으로 정규화한다.
 * - Notion `<aside>` 콜아웃 → 인용
 * - HTML 덩어리 → 마크다운 근사
 * - 이미 마크다운이면 태그 잔여만 정리
 */
export function normalizePasteToMarkdown(raw: string): string {
  if (!raw?.trim()) return "";

  let text = raw.replace(/\r\n/g, "\n");

  // 1) aside 콜아웃 (Notion 복사/내보내기)
  if (/<aside\b/i.test(text)) {
    text = convertAsideBlocks(text);
  }

  // 2) HTML 비중이 크면 전체 변환
  if (looksLikeHtml(text)) {
    text = simpleHtmlToMarkdown(text);
  } else {
    // 마크다운 위주 + 잔여 태그만 제거
    text = text
      .replace(/<\/?(?:span|font|div|p)\b[^>]*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n");
    // 남은 의미 없는 태그
    if (/<\/?[a-z][\s\S]*?>/i.test(text) && !/`[^`]*</.test(text)) {
      // 코드 스팬 안이 아닌 태그만 제거 시도
      text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");
    }
    text = decodeEntities(text);
  }

  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}
