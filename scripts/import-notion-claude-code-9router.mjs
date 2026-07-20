// Claude Code 9Router 설정 가이드와 연결 테스트 프롬프트를 저장한다
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { gunzipSync } from "zlib";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

const { markdownToTiptapDoc } = await import(
  resolve(root, "src/lib/markdown-to-tiptap.ts")
);

const SOURCE =
  "https://app.notion.com/p/Claude-Code-9Router-3a228466a54e81218b67fdb4dd482d72?source=copy_link";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const PAGE_TITLE = "Claude Code 한도 뒤에도 계속 코딩하는 9Router 설정";
const CATEGORY = "Claude Code · 9Router";
const now = new Date().toISOString();

// 로그인된 Notion 원문을 2026-07-21에 표와 코드 구조까지 보존해 압축한 스냅샷.
const PAGE_MARKDOWN_GZIP_BASE64 = "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";
const pageMarkdown = gunzipSync(
  Buffer.from(PAGE_MARKDOWN_GZIP_BASE64, "base64")
).toString("utf8");
const prompt = {
  title: "9Router 연결 성공 테스트",
  summary: "현재 폴더를 수정하지 않고 Claude Code와 9Router 연결만 확인합니다.",
  when: "9Router를 Claude Code에 연결한 직후 Usage 기록까지 확인할 때 사용하세요.",
  body: "현재 폴더의 파일은 수정하지 말고 “9Router 연결 성공”이라고 한 줄만 답해주세요.",
};

if (
  pageMarkdown.length < 7_000 ||
  !pageMarkdown.includes('"ANTHROPIC_BASE_URL": "http://localhost:20128/v1"') ||
  !pageMarkdown.includes(prompt.body)
) {
  throw new Error("Page 또는 Prompt 구성이 불완전합니다.");
}

if (process.argv.includes("--check")) {
  console.log({
    pageChars: pageMarkdown.length,
    codeBlocks: (pageMarkdown.match(/^\`\`\`/gm) ?? []).length / 2,
    prompts: 1,
  });
  process.exit(0);
}

const pageContent = JSON.stringify(markdownToTiptapDoc(pageMarkdown));
const db = new Database(resolve(root, "data/mymark.db"));
const findLocalPage = db.prepare(
  "SELECT id, content FROM custom_pages WHERE user_id = ? AND (title = ? OR content LIKE ?)"
);
const existingLocalPage = findLocalPage.get(
  LOCAL_USER,
  PAGE_TITLE,
  "%3a228466a54e81218b67fdb4dd482d72%"
);
const localPageId = existingLocalPage?.id ?? randomUUID();
let localPages = 0;
let localPageUpdates = 0;
let localPrompts = 0;

if (!existingLocalPage) {
  db.prepare(
    "INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(localPageId, LOCAL_USER, PAGE_TITLE, pageContent, now, now);
  localPages = 1;
} else if (existingLocalPage.content !== pageContent) {
  db.prepare(
    "UPDATE custom_pages SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  ).run(PAGE_TITLE, pageContent, now, localPageId, LOCAL_USER);
  localPageUpdates = 1;
}

const findLocalPrompt = db.prepare(
  "SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?"
);
if (!findLocalPrompt.get(LOCAL_USER, prompt.title, CATEGORY)) {
  db.prepare(
    "INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)"
  ).run(
    randomUUID(),
    LOCAL_USER,
    prompt.title,
    CATEGORY,
    prompt.summary,
    prompt.when,
    JSON.stringify([
      { title: "프롬프트", body: prompt.body },
      { title: "관련 Page", body: `/pages/${localPageId}` },
      { title: "원문", body: SOURCE },
    ]),
    now,
    now
  );
  localPrompts = 1;
}
db.close();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const { data: existingProdPages, error: pageLookupError } = await sb
  .from("custom_pages")
  .select("id, content")
  .eq("user_id", PROD_USER)
  .eq("title", PAGE_TITLE)
  .limit(1);
if (pageLookupError) throw pageLookupError;

const prodPageId = existingProdPages?.[0]?.id ?? randomUUID();
let prodPages = 0;
let prodPageUpdates = 0;
let prodPrompts = 0;
if (!existingProdPages?.length) {
  const { error } = await sb.from("custom_pages").insert({
    id: prodPageId,
    user_id: PROD_USER,
    title: PAGE_TITLE,
    content: pageContent,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  prodPages = 1;
} else if (existingProdPages[0].content !== pageContent) {
  const { error } = await sb
    .from("custom_pages")
    .update({ title: PAGE_TITLE, content: pageContent, updated_at: now })
    .eq("id", prodPageId)
    .eq("user_id", PROD_USER);
  if (error) throw error;
  prodPageUpdates = 1;
}

const { data: existingProdPrompts, error: promptLookupError } = await sb
  .from("prompts")
  .select("id")
  .eq("user_id", PROD_USER)
  .eq("title", prompt.title)
  .eq("category", CATEGORY)
  .limit(1);
if (promptLookupError) throw promptLookupError;
if (!existingProdPrompts?.length) {
  const { error } = await sb.from("prompts").insert({
    id: randomUUID(),
    user_id: PROD_USER,
    title: prompt.title,
    category: CATEGORY,
    summary: prompt.summary,
    when_to_use: prompt.when,
    sections: JSON.stringify([
      { title: "프롬프트", body: prompt.body },
      { title: "관련 Page", body: `/pages/${prodPageId}` },
      { title: "원문", body: SOURCE },
    ]),
    is_favorite: 0,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  prodPrompts = 1;
}

console.log({
  localPages,
  localPageUpdates,
  localPrompts,
  prodPages,
  prodPageUpdates,
  prodPrompts,
  localPage: `/pages/${localPageId}`,
  prodPage: `/pages/${prodPageId}`,
});
