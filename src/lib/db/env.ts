// DB 드라이버 선택 (Supabase Postgres vs 로컬 SQLite)

/** DATABASE_URL 이 postgres 이면 Supabase/Postgres 사용 */
export function usePostgres(): boolean {
  const url =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    "";
  return (
    url.startsWith("postgres://") ||
    url.startsWith("postgresql://")
  );
}

/** Postgres 연결 문자열 */
export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
}

/** Supabase 프로젝트 URL 이 설정되어 있는지 */
export function hasSupabaseProject(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}
