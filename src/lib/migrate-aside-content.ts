// 저장된 Tiptap 문서의 구형 aside·표·중복 제목 구조를 현재 노드로 정리한다

import { markdownToTiptapDoc } from "@/lib/markdown-to-tiptap";
import {
  decodeEntities,
  hasLiteralAside,
  normalizePasteToMarkdown,
} from "@/lib/normalize-to-markdown";

type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/** 노드 트리에서 모든 text 를 이어 붙인다. */
function collectText(node: TipTapNode | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (!node.content) return "";
  return node.content.map(collectText).join("");
}

/** 페이지 제목과 같은 첫 H1은 별도 제목 입력과 중복되므로 제거한다. */
export function removeDuplicateLeadingTitle(
  content: unknown,
  title: string
): { content: unknown; changed: boolean } {
  if (!content || typeof content !== "object") {
    return { content, changed: false };
  }
  const doc = content as TipTapNode;
  const first = doc.type === "doc" ? doc.content?.[0] : undefined;
  if (
    first?.type !== "heading" ||
    Number(first.attrs?.level ?? 1) !== 1 ||
    collectText(first).replace(/\s+/g, " ").trim() !==
      title.replace(/\s+/g, " ").trim()
  ) {
    return { content, changed: false };
  }
  return {
    content: { ...doc, content: doc.content?.slice(1) ?? [] },
    changed: true,
  };
}

/** 예전 파서가 한 문단으로 합친 GFM 표를 실제 table 노드로 복원한다. */
export function migrateLegacyMarkdownTablesInTiptapDoc(
  content: unknown
): { content: unknown; changed: boolean } {
  if (!content || typeof content !== "object") {
    return { content, changed: false };
  }
  const doc = content as TipTapNode;
  if (doc.type !== "doc" || !Array.isArray(doc.content)) {
    return { content, changed: false };
  }

  let changed = false;
  const nextContent = doc.content.flatMap((block) => {
    if (block.type !== "paragraph") return [block];
    const text = collectText(block).trim();
    if (!/^\|.+\|\s+\|\s*:?-{3,}/.test(text)) return [block];

    const rows = text
      .split(/\|\s+\|/)
      .map((row, index, all) => {
        const left = index === 0 ? "" : "| ";
        const right = index === all.length - 1 ? "" : " |";
        return `${left}${row.trim()}${right}`;
      })
      .join("\n");
    const parsed = markdownToTiptapDoc(rows) as TipTapNode;
    const table = parsed.content?.find((node) => node.type === "table");
    if (!table) return [block];
    changed = true;
    return [table];
  });

  return changed
    ? { content: { ...doc, content: nextContent }, changed: true }
    : { content, changed: false };
}

/**
 * 문서 전체 텍스트에 리터럴 aside 가 있으면
 * 마크다운 정규화 → 재파싱한 문서로 교체한다.
 * 이미 callout 노드만 있으면 그대로 둔다.
 */
export function migrateAsideInTiptapDoc(content: unknown): {
  content: unknown;
  changed: boolean;
} {
  if (!content || typeof content !== "object") {
    return { content, changed: false };
  }

  const doc = content as TipTapNode;
  if (doc.type !== "doc" || !Array.isArray(doc.content)) {
    return { content, changed: false };
  }

  // 이미 callout 이 있고 리터럴 태그가 없으면 스킵
  const flat = collectText(doc);
  const decoded = decodeEntities(flat);
  if (!hasLiteralAside(decoded) && !hasLiteralAside(flat)) {
    // content 배열 안 paragraph 단위도 검사
    const anyLiteral = doc.content.some((n) =>
      hasLiteralAside(collectText(n))
    );
    if (!anyLiteral) return { content, changed: false };
  }

  // 전체 문서를 평문으로 뽑은 뒤 정규화·재파싱
  // (단락 구분은 노드 경계를 줄바꿈 두 번으로)
  const pieces: string[] = [];
  for (const block of doc.content) {
    if (block.type === "callout") {
      const inner = collectText(block).trim();
      pieces.push(`:::callout\n${inner}\n:::`);
      continue;
    }
    if (block.type === "heading") {
      const level = Number(block.attrs?.level ?? 1);
      pieces.push(`${"#".repeat(level)} ${collectText(block).trim()}`);
      continue;
    }
    if (block.type === "codeBlock") {
      pieces.push("```\n" + collectText(block) + "\n```");
      continue;
    }
    if (block.type === "blockquote") {
      pieces.push(
        collectText(block)
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")
      );
      continue;
    }
    pieces.push(collectText(block));
  }

  const raw = pieces.join("\n\n");
  if (!hasLiteralAside(raw) && !hasLiteralAside(decodeEntities(raw))) {
    return { content, changed: false };
  }

  const md = normalizePasteToMarkdown(raw);
  const next = markdownToTiptapDoc(md) as TipTapNode;
  return { content: next, changed: true };
}

/**
 * 클립보드 평문/HTML 을 TipTap insertContent 용 노드 배열로 만든다.
 */
export function pastedAsideToNodes(raw: string): TipTapNode[] {
  const md = normalizePasteToMarkdown(raw);
  const doc = markdownToTiptapDoc(md) as TipTapNode;
  return Array.isArray(doc.content) ? doc.content : [];
}
