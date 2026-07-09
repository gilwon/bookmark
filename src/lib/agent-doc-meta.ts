// 마크다운 본문에서 제목·설명 자동 추출
import type { AgentDocFilePart } from "@/lib/agent-doc-bundle";
import { pickPrimaryFile } from "@/lib/agent-doc-bundle";

/**
 * YAML frontmatter / # 제목 / 첫 문단에서 title·description 을 뽑는다.
 */
export function extractTitleAndDescription(
  content: string,
  fallbackTitle: string
): { title: string; description: string } {
  let title = fallbackTitle.trim() || "제목 없는 문서";
  let description = "";
  let body = content;

  // --- YAML frontmatter ---
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fm) {
    const yaml = fm[1] ?? "";
    body = fm[2] ?? "";

    const name =
      yaml.match(/^name:\s*["']?([^\n"']+)["']?\s*$/m) ||
      yaml.match(/^title:\s*["']?([^\n"']+)["']?\s*$/m);
    if (name?.[1]) title = name[1].trim();

    // description: single line
    const descLine = yaml.match(
      /^description:\s*["']([^"']+)["']\s*$/m
    ) || yaml.match(/^description:\s+([^\n|>][^\n]*)\s*$/m);
    if (descLine?.[1]) {
      description = descLine[1].trim();
    } else {
      // description: |  or >
      const block = yaml.match(
        /^description:\s*[|>]-?\s*\n((?:[ \t]+.+\n?)+)/m
      );
      if (block?.[1]) {
        description = block[1]
          .split("\n")
          .map((l) => l.replace(/^[ \t]+/, "").trim())
          .filter(Boolean)
          .join(" ");
      }
    }
  }

  // --- # 제목 ---
  const h1 = body.match(/^#\s+(.+?)\s*$/m);
  if (h1?.[1] && (!fm || title === fallbackTitle)) {
    title = h1[1].trim();
  }

  // --- 첫 문단 (설명이 비었을 때) ---
  if (!description) {
    const lines = body.split(/\r?\n/);
    const chunks: string[] = [];
    let started = false;
    for (const line of lines) {
      const t = line.trim();
      if (!started) {
        if (!t || t.startsWith("#") || t.startsWith("```") || t.startsWith("---")) {
          continue;
        }
        started = true;
      }
      if (!t) break;
      if (t.startsWith("#") || t.startsWith("```") || t.startsWith("-") || t.startsWith("*") || t.startsWith("|")) {
        if (chunks.length) break;
        continue;
      }
      chunks.push(t.replace(/^>\s*/, ""));
      if (chunks.join(" ").length > 160) break;
    }
    description = chunks.join(" ").replace(/\s+/g, " ").trim();
  }

  // 정리
  title = title.slice(0, 120) || fallbackTitle || "제목 없는 문서";
  description = description.slice(0, 240);

  return { title, description };
}

/**
 * 번들 파일에서 대표 본문 기준으로 메타 추출.
 * packageName 이 있으면 제목 후보로 우선.
 */
export function extractMetaFromFiles(
  files: AgentDocFilePart[],
  packageName?: string
): { title: string; description: string } {
  const primary = pickPrimaryFile(files);
  const fallback =
    packageName ||
    primary?.filename.replace(/\.md$/i, "").replace(/\.skill$/i, "") ||
    "제목 없는 문서";
  const content = primary?.content ?? files[0]?.content ?? "";
  return extractTitleAndDescription(content, fallback);
}
