// 목록 페이지 searchParams → page/q/offset
import { DEFAULT_PAGE_SIZE } from "@/lib/list-utils";

export type ListQuery = {
  page: number;
  q: string;
  limit: number;
  offset: number;
};

export function parseListQuery(sp: {
  page?: string;
  q?: string;
}): ListQuery {
  const raw = Number.parseInt(String(sp.page ?? "1"), 10);
  const page = Number.isFinite(raw) && raw > 0 ? raw : 1;
  const q = (sp.q ?? "").trim();
  const limit = DEFAULT_PAGE_SIZE;
  return { page, q, limit, offset: (page - 1) * limit };
}
