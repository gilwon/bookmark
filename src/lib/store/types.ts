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
