// 간단한 Markdown → Tiptap JSON 변환 (저장·에디터 호환용)
import { normalizePasteToMarkdown } from "@/lib/normalize-to-markdown";

type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/** Markdown 표 한 행을 셀 문자열로 나눈다. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  let escaped = false;

  for (const char of trimmed) {
    if (escaped) {
      cell += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** GFM 표 구분 행인지 확인한다. */
function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/** Markdown 표를 Tiptap TableKit JSON 노드로 변환한다. */
function parseTable(lines: string[]): TipTapNode {
  const rows = [lines[0]!, ...lines.slice(2)].map(splitTableRow);
  const columnCount = Math.max(...rows.map((row) => row.length));

  return {
    type: "table",
    content: rows.map((row, rowIndex) => ({
      type: "tableRow",
      content: Array.from({ length: columnCount }, (_, columnIndex) => ({
        type: rowIndex === 0 ? "tableHeader" : "tableCell",
        content: [
          {
            type: "paragraph",
            content: parseInline(row[columnIndex] ?? ""),
          },
        ],
      })),
    })),
  };
}

/** 인라인 텍스트(볼드/이탤릭/코드/링크)를 대략 파싱한다. */
function parseInline(text: string): TipTapNode[] {
  if (!text) return [];
  const nodes: TipTapNode[] = [];
  // 링크 [text](url) · `code` · **bold** · *italic*
  const re =
    /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|([^*`\[\\]+)|([*`\[\\])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined && m[2] !== undefined) {
      nodes.push({
        type: "text",
        text: m[1],
        marks: [{ type: "link", attrs: { href: m[2] } }],
      });
    } else if (m[3] !== undefined) {
      nodes.push({
        type: "text",
        text: m[3],
        marks: [{ type: "code" }],
      });
    } else if (m[4] !== undefined) {
      nodes.push({
        type: "text",
        text: m[4],
        marks: [{ type: "bold" }],
      });
    } else if (m[5] !== undefined) {
      nodes.push({
        type: "text",
        text: m[5],
        marks: [{ type: "italic" }],
      });
    } else if (m[6] !== undefined) {
      nodes.push({ type: "text", text: m[6] });
    } else if (m[7] !== undefined) {
      nodes.push({ type: "text", text: m[7] });
    }
  }
  if (nodes.length === 0 && text) {
    nodes.push({ type: "text", text });
  }
  return nodes;
}

/**
 * 마크다운 문자열을 Tiptap doc JSON 으로 변환한다.
 * 헤딩·리스트·코드블록·인용·단락 위주.
 */
export function markdownToTiptapDoc(md: string): TipTapNode {
  // 붙여넣기 HTML·<aside> 등을 먼저 마크다운으로
  const normalized = normalizePasteToMarkdown(md);
  const lines = normalized.replace(/\r\n/g, "\n").split("\n");
  const content: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // 빈 줄
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // :::callout 펜스 → TipTap callout 노드 (<aside> 대응)
    if (/^:::callout\s*$/i.test(line.trim())) {
      i += 1;
      const calloutLines: string[] = [];
      while (i < lines.length && !/^:::\s*$/.test((lines[i] ?? "").trim())) {
        calloutLines.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1; // closing :::
      const inner: TipTapNode[] = [];
      const body = calloutLines.join("\n").trim();
      if (!body) {
        inner.push({ type: "paragraph" });
      } else {
        for (const para of body.split(/\n{2,}/)) {
          const t = para.replace(/\n/g, " ").trim();
          if (!t) continue;
          inner.push({
            type: "paragraph",
            content: parseInline(t),
          });
        }
        if (inner.length === 0) inner.push({ type: "paragraph" });
      }
      content.push({ type: "callout", content: inner });
      continue;
    }

    // fenced code
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim() || null;
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i] ?? "")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1; // closing ```
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: codeLines.length
          ? [{ type: "text", text: codeLines.join("\n") }]
          : undefined,
      });
      continue;
    }

    // heading
    const hm = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hm) {
      content.push({
        type: "heading",
        attrs: { level: hm[1]!.length },
        content: parseInline(hm[2]!.trim()),
      });
      i += 1;
      continue;
    }

    // GFM table
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableDivider(lines[i + 1] ?? "")
    ) {
      const tableLines = [line, lines[i + 1] ?? ""];
      i += 2;
      while (i < lines.length && (lines[i] ?? "").trim().includes("|")) {
        tableLines.push(lines[i] ?? "");
        i += 1;
      }
      content.push(parseTable(tableLines));
      continue;
    }

    // blockquote (연속)
    if (/^>\s?/.test(line)) {
      const qLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        qLines.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: parseInline(qLines.join(" ").trim()),
          },
        ],
      });
      continue;
    }

    // unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: TipTapNode[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i] ?? "")) {
        const text = (lines[i] ?? "").replace(/^[-*+]\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i += 1;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: TipTapNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        const text = (lines[i] ?? "").replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i += 1;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      content.push({ type: "horizontalRule" });
      i += 1;
      continue;
    }

    // paragraph (연속 비빈 줄 합침)
    const pLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,6}\s|```|>\s?|[-*+]\s+|\d+\.\s+|(-{3,}|\*{3,}|_{3,})$)/.test(
        lines[i] ?? ""
      )
    ) {
      pLines.push(lines[i] ?? "");
      i += 1;
    }
    content.push({
      type: "paragraph",
      content: parseInline(pLines.join(" ").trim()),
    });
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}
