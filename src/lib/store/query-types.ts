// 목록·검색·집계용 옵션 타입

export type DateRangeOpts = {
  from?: string;
  to?: string;
};

export type SearchOpts = DateRangeOpts & {
  q?: string;
  category?: string;
  tag?: string;
  limit?: number;
};

/** 서버 페이징 목록 */
export type ListPageOpts = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type DashboardCounts = {
  bookmarks: number;
  stars: number;
  pages: number;
  copies: number;
  agentDocs: number;
  categories: number;
};

export type CategoryCount = {
  name: string;
  count: number;
};
