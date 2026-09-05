// PostgREST 기본 1000행 절단을 피하려고 range로 이어 붙인다.

export const SUPABASE_MAX_ROWS = 1000;

/** from/to는 inclusive. 한 페이지가 take보다 짧으면 끝. */
export async function fetchAllPaged<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  maxRows?: number
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  const cap =
    maxRows != null && maxRows > 0 ? maxRows : Number.POSITIVE_INFINITY;
  while (out.length < cap) {
    const take = Math.min(SUPABASE_MAX_ROWS, cap - out.length);
    const page = await fetchPage(from, from + take - 1);
    out.push(...page);
    if (page.length < take) break;
    from += take;
  }
  return out;
}
