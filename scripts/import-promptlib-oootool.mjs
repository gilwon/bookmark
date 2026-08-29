// prompts.oootool.com의 GPT 프롬프트 271건을 로컬 SQLite와 운영 Supabase에 저장한다
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^(["'])|(["'])$/g, "");
  }
}

export const LOCAL_USER = "dev";
export const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const CATEGORY_PREFIX = "PromptLib";
export const SNAPSHOT_PATH = resolve(root, "scripts/data/promptlib-oootool.json");

// 원본 항목을 prompts 테이블 행으로 매핑한다
export function toPromptRow(item, userId, now) {
  const capabilities = item.capabilities ?? [];
  const starters = item.conversationStarters ?? [];
  const sections = [{ title: "프롬프트", body: item.instructions }];
  if (starters.length) {
    sections.push({ title: "대화 시작 예시", body: starters.join("\n") });
  }
  return {
    id: randomUUID(),
    user_id: userId,
    title: item.title.trim(),
    category: `${CATEGORY_PREFIX} · ${item.category}`,
    summary: item.description,
    when_to_use: capabilities.length ? `기능. ${capabilities.join(", ")}` : null,
    sections: JSON.stringify(sections),
    is_favorite: 0,
    created_at: now,
    updated_at: now,
  };
}

// 제목만으로는 중복 판정이 안 되므로 제목·요약·본문을 합쳐 중복 키를 만든다
export function dedupeKey(row) {
  return `${row.title}\n${row.summary ?? ""}\n${row.sections}`;
}

async function main() {
  const items = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  const now = new Date().toISOString();

  const db = new Database(resolve(root, "data/mymark.db"));
  const existingLocal = new Set(
    db
      .prepare("SELECT title, summary, sections FROM prompts WHERE category LIKE 'PromptLib · %'")
      .all()
      .map(dedupeKey)
  );
  const localRows = [];
  for (const item of items) {
    const row = toPromptRow(item, LOCAL_USER, now);
    if (existingLocal.has(dedupeKey(row))) continue;
    localRows.push(row);
  }
  const insert = db.prepare(
    "INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)"
  );
  db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  })(localRows);
  db.close();
  const localInserted = localRows.length;
  const localSkipped = items.length - localInserted;

  let prodInserted = 0;
  let prodSkipped = 0;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const existingProd = new Set();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from("prompts")
        .select("title, summary, sections")
        .like("category", `${CATEGORY_PREFIX} · %`)
        .range(from, from + 999);
      if (error) throw error;
      for (const row of data ?? []) existingProd.add(dedupeKey(row));
      if (!data || data.length < 1000) break;
    }
    const prodRows = [];
    for (const item of items) {
      const row = toPromptRow(item, PROD_USER, now);
      if (existingProd.has(dedupeKey(row))) {
        prodSkipped++;
        continue;
      }
      prodRows.push(row);
    }
    for (let i = 0; i < prodRows.length; i += 50) {
      const chunk = prodRows.slice(i, i + 50);
      const { error } = await sb.from("prompts").insert(chunk);
      if (error) throw error;
      prodInserted += chunk.length;
    }
  } else {
    console.log("Supabase 환경변수 없음 — 운영 단계는 건너뛴다");
  }

  console.log({ localInserted, localSkipped, prodInserted, prodSkipped, total: items.length });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
