// 앱 전역에서 공유하는 타입 정의

/** 북마크 엔티티 (API/UI 공통) */
export type Bookmark = {
  id: string;
  userId: string;
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  favicon: string | null;
  tags: string[];
  category: string | null;
  createdAt: string;
};

/** GitHub Star 엔티티 */
export type GithubStar = {
  id: string;
  userId: string;
  repoFullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  url: string;
  lastSynced: string;
  createdAt: string;
  /** 동기화 후 미확인 변경 */
  changeKind?: "new" | "updated" | null;
  starsDelta?: number;
  changedAt?: string | null;
};

/** 커스텀 페이지 엔티티 */
export type CustomPage = {
  id: string;
  userId: string;
  title: string;
  content: unknown;
  createdAt: string;
  updatedAt: string;
};

/** URL 메타 추출 결과 */
export type UrlMeta = {
  title: string;
  description: string | null;
  image: string | null;
  favicon: string | null;
};

/** 에이전트 문서 종류 */
export type AgentDocKind = "skill" | "agents" | "claude" | "other";

/** 번들 내 개별 파일 (.md / .skill) */
export type AgentDocFile = {
  filename: string;
  content: string;
};

/** SKILL.md / AGENTS.md / CLAUDE.md / .skill 번들 문서 */
export type AgentDoc = {
  id: string;
  userId: string;
  kind: AgentDocKind;
  /** 대표 파일명 (보통 SKILL.md) */
  filename: string;
  title: string;
  description: string | null;
  /** 대표 파일 본문 */
  content: string;
  /** 전체 번들 파일 (skill.md + .skill 등) */
  files: AgentDocFile[];
  createdAt: string;
  updatedAt: string;
};
