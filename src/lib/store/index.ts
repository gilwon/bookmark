// 데이터 스토어 — Supabase JS(B) 또는 로컬 SQLite
import { getDbBackend } from "@/lib/db/env";
import * as sqlite from "./sqlite-store";
import * as supabase from "./supabase-store";

const backend = getDbBackend();

if (typeof console !== "undefined" && !(globalThis as { __mymarkStoreLogged?: boolean }).__mymarkStoreLogged) {
  console.info(
    `[db] backend=${backend}${backend === "supabase" ? " (Supabase JS)" : " (local SQLite)"}`
  );
  (globalThis as { __mymarkStoreLogged?: boolean }).__mymarkStoreLogged = true;
}

const impl = backend === "supabase" ? supabase : sqlite;

export const store = impl;
export type { BookmarkRow, GithubStarRow, CustomPageRow, AgentDocRow, OauthTokenRow } from "./types";
