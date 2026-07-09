// 백엔드 선택: Supabase JS (B) vs 로컬 SQLite

/**
 * Supabase JS 모드 — URL + service_role 이 있으면 활성화.
 * DATABASE_URL(직접 Postgres) 은 사용하지 않는다.
 */
export function useSupabaseJs(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export type DbBackend = "supabase" | "sqlite";

export function getDbBackend(): DbBackend {
  return useSupabaseJs() ? "supabase" : "sqlite";
}
