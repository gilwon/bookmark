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

/** Vercel/서버리스에서는 SQLite 폴백을 막고 Supabase 설정을 강제한다. */
function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

export function getDbBackend(): DbBackend {
  if (useSupabaseJs()) return "supabase";
  if (isServerless()) {
    throw new Error(
      "[db] Vercel에는 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. " +
        "로컬 SQLite 폴백은 서버리스에서 동작하지 않습니다."
    );
  }
  return "sqlite";
}
