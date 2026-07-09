// 에이전트 문서(SKILL / AGENTS / CLAUDE) 템플릿과 종류 유틸
import type { AgentDocKind } from "@/lib/types";

export type AgentDocTemplate = {
  kind: AgentDocKind;
  filename: string;
  title: string;
  description: string;
  content: string;
};

/** kind 라벨 (UI용) */
export const AGENT_DOC_KIND_LABEL: Record<AgentDocKind, string> = {
  skill: "SKILL.md",
  agents: "AGENTS.md",
  claude: "CLAUDE.md",
  other: "기타",
};

/** kind별 아이콘·배지 색 (리스트에서 카테고리 구분) */
export const AGENT_DOC_KIND_COLOR: Record<
  AgentDocKind,
  { icon: string; badge: string }
> = {
  skill: {
    icon: "bg-violet-600/15 text-violet-600 dark:text-violet-300",
    badge:
      "border-violet-500/30 bg-violet-600/15 text-violet-700 dark:text-violet-300",
  },
  agents: {
    icon: "bg-sky-600/15 text-sky-600 dark:text-sky-300",
    badge:
      "border-sky-500/30 bg-sky-600/15 text-sky-700 dark:text-sky-300",
  },
  claude: {
    icon: "bg-amber-600/15 text-amber-700 dark:text-amber-300",
    badge:
      "border-amber-500/30 bg-amber-600/15 text-amber-800 dark:text-amber-300",
  },
  other: {
    icon: "bg-slate-600/15 text-slate-600 dark:text-slate-300",
    badge:
      "border-slate-500/30 bg-slate-600/15 text-slate-700 dark:text-slate-300",
  },
};

/** 파일명에서 kind를 추론한다. */
export function inferKindFromFilename(filename: string): AgentDocKind {
  const base = filename.trim().replace(/\\/g, "/").split("/").pop() || "";
  const lower = base.toLowerCase();
  if (lower === "skill.md" || lower.endsWith(".skill")) return "skill";
  if (lower === "agents.md") return "agents";
  if (lower === "claude.md") return "claude";
  return "other";
}

/** 빈/신규 문서용 기본 템플릿 목록 */
export function getAgentDocTemplates(): AgentDocTemplate[] {
  return [
    {
      kind: "skill",
      filename: "SKILL.md",
      title: "SKILL.md",
      description: "에이전트 스킬 정의 (트리거·절차·제약)",
      content: `---
name: example-skill
description: Use when …
---

# Example Skill

## When to Use
- …

## Steps
1. …
2. …

## Constraints
- …
`,
    },
    {
      kind: "agents",
      filename: "AGENTS.md",
      title: "AGENTS.md",
      description: "저장소/에이전트 운영 규칙",
      content: `# AGENTS.md

## Project Overview
- …

## Conventions
- Language / style
- Test / commit rules

## Commands
\`\`\`bash
npm run dev
npm test
\`\`\`

## Notes for Agents
- …
`,
    },
    {
      kind: "claude",
      filename: "CLAUDE.md",
      title: "CLAUDE.md",
      description: "Claude Code 프로젝트 메모리 / 가이드",
      content: `# CLAUDE.md

## Project
- …

## Do
- …

## Don't
- …

## Architecture
- …

## Workflow
1. …
`,
    },
    {
      kind: "other",
      filename: "NOTES.md",
      title: "NOTES.md",
      description: "기타 Markdown 지시/메모",
      content: `# Notes

- …
`,
    },
  ];
}

/**
 * 파일명 정규화 (경로 제거).
 * .skill 은 유지, 그 외 확장자 없으면 .md 부여.
 */
export function normalizeFilename(raw: string): string {
  let name = raw.trim().replace(/\\/g, "/").split("/").pop() || "NOTES.md";
  if (/\.skill$/i.test(name)) return name;
  if (/\.(md|markdown|mdx|txt)$/i.test(name)) return name;
  return `${name}.md`;
}
