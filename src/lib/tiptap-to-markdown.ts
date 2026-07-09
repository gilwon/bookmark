// TipTap JSON 문서를 Markdown 문자열로 변환한다

type Mark = {
  type: string;
  attrs?: Record<string, unknown>;
};

type TipTapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Mark[];
};

/** 인라인 마크를 Markdown 문법으로 감싼다. */
function applyMarks(text: string, marks?: Mark[]): string {
  if (!marks?.length) return text;
  let out = text;
  // 안쪽부터: code → bold/italic/strike/underline → link
  const ordered = [...marks].sort((a, b) => {
    const rank = (t: string) =>
      t === "code"
        ? 0
        : t === "bold" || t === "italic" || t === "strike" || t === "underline"
          ? 1
          : t === "link"
            ? 2
            : 3;
    return rank(a.type) - rank(b.type);
  });
  for (const m of ordered) {
    switch (m.type) {
      case "code":
        out = `\`${out}\``;
        break;
      case "bold":
        out = `**${out}**`;
        break;
      case "italic":
        out = `*${out}*`;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "underline":
        // Markdown 표준 underline 없음 → HTML 유지
        out = `<u>${out}</u>`;
        break;
      case "link": {
        const href = String(m.attrs?.href ?? "");
        out = href ? `[${out}](${href})` : out;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** 인라인 노드 배열을 한 줄 텍스트로 합친다. */
function inlineToMd(nodes?: TipTapNode[]): string {
  if (!nodes?.length) return "";
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type === "text" || n.text != null) {
        return applyMarks(n.text ?? "", n.marks);
      }
      // 중첩 인라인 (드묾)
      if (n.content) return inlineToMd(n.content);
      return "";
    })
    .join("");
}

/** 리스트를 indent 적용해 Markdown으로. */
function listToMd(node: TipTapNode, indent: number): string {
  const pad = "  ".repeat(indent);
  const items = node.content ?? [];
  const lines: string[] = [];

  items.forEach((item, idx) => {
    if (item.type !== "listItem" && item.type !== "taskItem") return;

    let prefix: string;
    if (node.type === "taskList" || item.type === "taskItem") {
      const checked = Boolean(item.attrs?.checked);
      prefix = checked ? "- [x] " : "- [ ] ";
    } else if (node.type === "orderedList") {
      const start = Number(node.attrs?.start ?? 1);
      prefix = `${start + idx}. `;
    } else {
      prefix = "- ";
    }

    const bodyParts: string[] = [];
    const nested: TipTapNode[] = [];
    for (const child of item.content ?? []) {
      if (
        child.type === "bulletList" ||
        child.type === "orderedList" ||
        child.type === "taskList"
      ) {
        nested.push(child);
      } else if (child.type === "paragraph") {
        bodyParts.push(inlineToMd(child.content));
      } else {
        bodyParts.push(blockToMd(child).trimEnd());
      }
    }

    const first = bodyParts[0] ?? "";
    lines.push(`${pad}${prefix}${first}`);
    // 이어지는 문단
    for (let i = 1; i < bodyParts.length; i++) {
      lines.push(`${pad}  ${bodyParts[i]}`);
    }
    for (const nest of nested) {
      lines.push(listToMd(nest, indent + 1).trimEnd());
    }
  });

  return lines.join("\n") + "\n\n";
}

/** 단일 블록 노드 → Markdown. */
function blockToMd(node: TipTapNode): string {
  switch (node.type) {
    case "paragraph":
      return inlineToMd(node.content) + "\n\n";

    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${"#".repeat(level)} ${inlineToMd(node.content)}\n\n`;
    }

    case "bulletList":
    case "orderedList":
    case "taskList":
      return listToMd(node, 0);

    case "codeBlock": {
      const lang = String(node.attrs?.language ?? "").trim();
      const code = (node.content ?? [])
        .map((c) => c.text ?? "")
        .join("");
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }

    case "blockquote": {
      const inner = (node.content ?? [])
        .map((c) => blockToMd(c).trimEnd())
        .join("\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return `${inner}\n\n`;
    }

    case "callout": {
      const body = (node.content ?? [])
        .map((c) => blockToMd(c).trimEnd())
        .join("\n")
        .trim();
      return `:::callout\n${body}\n:::\n\n`;
    }

    case "horizontalRule":
      return "---\n\n";

    case "hardBreak":
      return "  \n";

    case "embedBlock": {
      const title = String(node.attrs?.title ?? "embed").trim() || "embed";
      const url = String(node.attrs?.url ?? "").trim();
      return url ? `[${title}](${url})\n\n` : `${title}\n\n`;
    }

    case "image": {
      const src = String(node.attrs?.src ?? "").trim();
      const alt = String(node.attrs?.alt ?? "").trim();
      return src ? `![${alt}](${src})\n\n` : "";
    }

    case "text":
      return applyMarks(node.text ?? "", node.marks);

    default:
      // 알 수 없는 블록: 자식만 펼침
      if (node.content?.length) {
        return node.content.map(blockToMd).join("");
      }
      return "";
  }
}

/**
 * TipTap 문서 JSON을 Markdown 문자열로 변환한다.
 * doc 루트 또는 content 배열 모두 허용.
 */
export function tiptapToMarkdown(doc: unknown): string {
  if (doc == null) return "";
  const root = doc as TipTapNode;
  const blocks =
    root.type === "doc"
      ? (root.content ?? [])
      : Array.isArray(doc)
        ? (doc as TipTapNode[])
        : root.content ?? [root];

  const md = blocks.map(blockToMd).join("");
  // 끝 공백 정리 (최대 한 줄 개행 유지)
  return md.replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "\n");
}

/**
 * Markdown 문자열을 브라우저에서 파일로 다운로드한다.
 */
export function downloadMarkdown(filename: string, markdown: string): void {
  const safe =
    filename
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "untitled";
  const name = safe.endsWith(".md") ? safe : `${safe}.md`;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
