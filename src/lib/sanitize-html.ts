// 브라우저용 HTML 미리보기 정화 (script/이벤트/javascript: 제거)

const ALLOWED_TAGS = new Set([
  "A",
  "ABBR",
  "B",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DEL",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "I",
  "LI",
  "OL",
  "P",
  "PRE",
  "S",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TABLE",
  "TBODY",
  "TD",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL",
  "IMG",
]);

const ALLOWED_ATTR: Record<string, Set<string>> = {
  A: new Set(["href", "title", "rel", "target"]),
  IMG: new Set(["src", "alt", "title", "width", "height"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan"]),
  CODE: new Set(["class"]),
  SPAN: new Set(["class"]),
  PRE: new Set(["class"]),
};

function isSafeUrl(value: string, attr: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^\s*javascript:/i.test(v) || /^\s*data:/i.test(v) || /^\s*vbscript:/i.test(v)) {
    // data:image 만 허용
    if (attr === "src" && /^\s*data:image\//i.test(v)) return true;
    return false;
  }
  return true;
}

/**
 * marked 등 결과를 미리보기용으로 정화한다.
 * 서버(SSR)에서는 빈 문자열 — 클라이언트에서만 사용.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return "";
  }
  const doc = new DOMParser().parseFromString(
    `<div id="__root">${html}</div>`,
    "text/html"
  );
  const root = doc.getElementById("__root");
  if (!root) return "";

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toUpperCase();
        if (!ALLOWED_TAGS.has(tag)) {
          // 텍스트는 유지하고 위험 태그만 제거
          const text = doc.createTextNode(el.textContent ?? "");
          el.replaceWith(text);
          continue;
        }
        const allowed = ALLOWED_ATTR[tag] ?? new Set<string>();
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (name.startsWith("on") || name === "style" || name === "srcdoc") {
            el.removeAttribute(attr.name);
            continue;
          }
          if (!allowed.has(attr.name) && !allowed.has(name)) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (
            (name === "href" || name === "src") &&
            !isSafeUrl(attr.value, name)
          ) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (name === "target") {
            el.setAttribute("rel", "noopener noreferrer");
          }
        }
        walk(el);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.parentNode?.removeChild(child);
      }
    }
  };

  walk(root);
  return root.innerHTML;
}
