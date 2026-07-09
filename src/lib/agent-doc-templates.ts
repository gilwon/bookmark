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

/** 파일명에서 kind를 추론한다. */
export function inferKindFromFilename(filename: string): AgentDocKind {
  const base = filename.trim().toLowerCase();
  if (base === "skill.md" || base.endsWith("/skill.md")) return "skill";
  if (base === "agents.md" || base.endsWith("/agents.md")) return "agents";
  if (base === "claude.md" || base.endsWith("/claude.md")) return "claude";
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

/** 파일명 정규화 (.md 보장, 경로 구분자 제거) */
export function normalizeFilename(raw: string): string {
  let name = raw.trim().replace(/\\/g, "/").split("/").pop() || "NOTES.md";
  if (!name.toLowerCase().endsWith(".md")) {
    name = `${name}.md`;
  }
  return name;
}
