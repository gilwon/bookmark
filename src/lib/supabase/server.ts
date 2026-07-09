// Supabase 서버 클라이언트 (service_role — RLS 우회, 서버 전용)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * service_role 키로 Supabase 클라이언트를 만든다.
 * DB 쿼리는 Drizzle(DATABASE_URL)을 쓰고, 스토리지 등 Supabase API용.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  if (!cached) {
    cached = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return cached;
}

/** Supabase 연동 준비 여부 (URL + service role 또는 DATABASE_URL) */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      (process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
