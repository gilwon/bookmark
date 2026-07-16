// 기존 Pages와 Prompts 데이터를 노션형 Tiptap 문서 형식으로 정규화
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { markdownToTiptapDoc } from "../src/lib/markdown-to-tiptap.ts";
import { migrateAsideInTiptapDoc } from "../src/lib/migrate-aside-content.ts";
import { tiptapToMarkdown } from "../src/lib/tiptap-to-markdown.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const now = new Date().toISOString();

function normalizePageContent(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === "doc" && Array.isArray(parsed.content)) {
      const migrated = migrateAsideInTiptapDoc(parsed);
      return { content: migrated.content, changed: migrated.changed };
    }
  } catch {
    // 기존 Markdown 문자열은 아래에서 노션 문서로 변환한다.
  }
  return {
    content: markdownToTiptapDoc(typeof raw === "string" ? raw : ""),
    changed: true,
  };
}

function isNotionPrompt(sections) {
  return (
    Array.isArray(sections) &&
    sections.length === 1 &&
    sections[0]?.content?.type === "doc" &&
    Array.isArray(sections[0].content.content)
  );
}

function normalizePromptSections(raw) {
  let sections = [];
  try {
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) sections = parsed;
  } catch {
    sections = [];
  }
  if (isNotionPrompt(sections)) return { sections, changed: false };

  const markdown = sections
    .map((section, index) => {
      const title =
        typeof section?.title === "string" && section.title.trim()
          ? section.title.trim()
          : `${index + 1}차 프롬프트`;
      const body = typeof section?.body === "string" ? section.body : "";
      return `## ${title}\n\n${body}`;
    })
    .join("\n\n");
  const content = markdownToTiptapDoc(markdown || "프롬프트 내용을 입력하세요.");
  return {
    sections: [
      {
        title: "프롬프트 문서",
        body: tiptapToMarkdown(content),
        content,
      },
    ],
    changed: true,
  };
}

function migrateLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const pages = db
    .prepare("SELECT id, content FROM custom_pages WHERE user_id = ?")
    .all(LOCAL_USER);
  const prompts = db
    .prepare("SELECT id, sections FROM prompts WHERE user_id = ?")
    .all(LOCAL_USER);
  const updatePage = db.prepare(
    "UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  );
  const updatePrompt = db.prepare(
    "UPDATE prompts SET sections = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  );
  let pageUpdates = 0;
  let promptUpdates = 0;
  const transaction = db.transaction(() => {
    for (const page of pages) {
      const normalized = normalizePageContent(page.content);
      if (!normalized.changed) continue;
      updatePage.run(JSON.stringify(normalized.content), now, page.id, LOCAL_USER);
      pageUpdates++;
    }
    for (const prompt of prompts) {
      const normalized = normalizePromptSections(prompt.sections);
      if (!normalized.changed) continue;
      updatePrompt.run(JSON.stringify(normalized.sections), now, prompt.id, LOCAL_USER);
      promptUpdates++;
    }
  });
  transaction();
  db.close();
  return { pageUpdates, promptUpdates };
}

async function migrateProduction() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수가 없습니다.");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const [{ data: pages, error: pageError }, { data: prompts, error: promptError }] =
    await Promise.all([
      sb.from("custom_pages").select("*").eq("user_id", PROD_USER),
      sb.from("prompts").select("*").eq("user_id", PROD_USER),
    ]);
  if (pageError) throw pageError;
  if (promptError) throw promptError;

  const pageUpdates = (pages ?? []).flatMap((page) => {
    const normalized = normalizePageContent(page.content);
    return normalized.changed
      ? [{ ...page, content: JSON.stringify(normalized.content), updated_at: now }]
      : [];
  });
  const promptUpdates = (prompts ?? []).flatMap((prompt) => {
    const normalized = normalizePromptSections(prompt.sections);
    return normalized.changed
      ? [{ ...prompt, sections: JSON.stringify(normalized.sections), updated_at: now }]
      : [];
  });

  for (const updates of [pageUpdates, promptUpdates]) {
    for (let start = 0; start < updates.length; start += 100) {
      const { error } = await sb
        .from(updates === pageUpdates ? "custom_pages" : "prompts")
        .upsert(updates.slice(start, start + 100), { onConflict: "id" });
      if (error) throw error;
    }
  }
  return { pageUpdates: pageUpdates.length, promptUpdates: promptUpdates.length };
}

const local = migrateLocal();
const production = await migrateProduction();
console.log(JSON.stringify({ local, production }));
