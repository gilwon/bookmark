// store 레이어 공통 행 타입 (앱 camelCase)

export type BookmarkRow = {
  id: string;
  userId: string;
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  favicon: string | null;
  tags: string;
  category: string | null;
  createdAt: string;
};

/** 동기화 후 카드 뱃지: 신규 / 업데이트 */
export type StarChangeKind = "new" | "updated" | null;

export type GithubStarRow = {
  id: string;
  userId: string;
  repoFullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  topics: string;
  url: string;
  lastSynced: string;
  createdAt: string;
  /** new | updated | null */
  changeKind: StarChangeKind;
  /** 직전 동기화 대비 stargazer 수 변화 */
  starsDelta: number;
  changedAt: string | null;
};

export type CustomPageRow = {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type OauthTokenRow = {
  id: string;
  userId: string;
  provider: string;
  accessTokenEnc: string;
  updatedAt: string;
};

export type AgentDocRow = {
  id: string;
  userId: string;
  kind: string;
  filename: string;
  title: string;
  description: string | null;
  content: string;
  bundle: string;
  createdAt: string;
  updatedAt: string;
};

/** 프롬프트 행 — sections 는 JSON 문자열 */
export type PromptRow = {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  summary: string | null;
  whenToUse: string | null;
  sections: string;
  createdAt: string;
  updatedAt: string;
};
