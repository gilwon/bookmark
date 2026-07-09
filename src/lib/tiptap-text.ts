// Tiptap JSON 문서에서 평문 검색용 텍스트를 추출한다

/** 노드 트리에서 text 필드를 재귀적으로 이어 붙인다. */
export function extractTiptapText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content.map(extractTiptapText).join(" ");
  }

  if (typeof content === "object") {
    const node = content as {
      text?: string;
      content?: unknown;
      attrs?: Record<string, unknown>;
    };
    const parts: string[] = [];
    if (typeof node.text === "string") parts.push(node.text);
    // 임베드 블록 제목·URL도 검색 대상
    if (node.attrs) {
      for (const key of ["title", "url", "description", "subtitle"]) {
        const v = node.attrs[key];
        if (typeof v === "string" && v) parts.push(v);
      }
    }
    if (node.content) parts.push(extractTiptapText(node.content));
    return parts.join(" ");
  }

  return "";
}
