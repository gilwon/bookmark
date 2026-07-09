// 데이터 스토어 — Supabase JS(B) 또는 로컬 SQLite (지연 로드)
// Vercel 등 서버리스에서는 SQLite 모듈을 절대 로드하면 안 됨
import { getDbBackend } from "@/lib/db/env";
import type * as StoreModule from "./sqlite-store";

type StoreImpl = typeof StoreModule;

let cached: StoreImpl | null = null;

/** 백엔드에 맞는 스토어만 로드한다. SQLite는 로컬 전용. */
function loadStore(): StoreImpl {
  if (cached) return cached;

  const backend = getDbBackend();
  if (typeof console !== "undefined" && !(globalThis as { __mymarkStoreLogged?: boolean }).__mymarkStoreLogged) {
    console.info(
      `[db] backend=${backend}${backend === "supabase" ? " (Supabase JS)" : " (local SQLite)"}`
    );
    (globalThis as { __mymarkStoreLogged?: boolean }).__mymarkStoreLogged = true;
  }

  if (backend === "supabase") {
    // require로 정적 분석에서 sqlite 경로를 끊는다
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("./supabase-store") as StoreImpl;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("./sqlite-store") as StoreImpl;
  }
  return cached;
}

/** 첫 메서드 접근 시에만 구현체를 로드하는 프록시 */
export const store = new Proxy({} as StoreImpl, {
  get(_target, prop, receiver) {
    const impl = loadStore();
    const value = Reflect.get(impl, prop, receiver);
    return typeof value === "function" ? value.bind(impl) : value;
  },
});

export type {
  BookmarkRow,
  GithubStarRow,
  CustomPageRow,
  AgentDocRow,
  OauthTokenRow,
  PromptRow,
} from "./types";
