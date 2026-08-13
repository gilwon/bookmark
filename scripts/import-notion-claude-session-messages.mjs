// Notion과 사용자 제공 원문 네 건을 Pages에 중복 없이 이관한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { newPageData } from "./notion-session-message-pages-data.mjs";
import { oldChatPageData } from "./notion-session-message-old-chat-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const oldChatSource = "https://app.notion.com/p/174b256827ac824288c401f5bfcd6224";
const newChatSource = "https://app.notion.com/p/gilwon/ChatGPT-40-6edb256827ac838abfda01aac69d9b29";
const chatTitle = "업무시간 단축시켜주는 ChatGPT 프롬프 40가지";

function canonicalContent(content, sourceAliases) {
  let parsed;
  try {
    parsed = JSON.parse(String(content));
  } catch {
    throw new Error("Page 본문 JSON이 올바르지 않아 저장을 중단했습니다.");
  }
  return JSON.stringify(parsed, (key, value) => (
    key === "href" && sourceAliases.includes(value) ? "__NOTION_SOURCE__" : value
  ));
}

export function planNotionSessionMessagePage(rows, record) {
  const titleRows = rows.filter((row) => row.title === record.title);
  if (titleRows.length > 1) {
    throw new Error("Page 제목이 중복되어 저장을 중단했습니다.");
  }
  const sourceRows = record.sourceAliases.length === 0
    ? []
    : rows.filter((row) => record.sourceAliases.some((source) => String(row.content).includes(source)));
  if (titleRows.length === 0) {
    if (sourceRows.length > 0) {
      throw new Error("Page 원문 식별자만 일치하는 문서가 있어 저장을 중단했습니다.");
    }
    return { action: "insert", row: null };
  }
  const row = titleRows[0];
  if (sourceRows.some((candidate) => candidate !== row)) {
    throw new Error("Page 제목과 원문 식별자 후보가 달라 저장을 중단했습니다.");
  }
  if (canonicalContent(row.content, record.sourceAliases) === canonicalContent(record.content, record.sourceAliases)) {
    return { action: "skip", row };
  }
  if (record.exactDuplicateOnly) {
    throw new Error("기존 ChatGPT Page 본문이 달라 덮어쓰지 않고 중단했습니다.");
  }
  if (sourceRows.length === 1) {
    return { action: "update", row };
  }
  throw new Error("같은 제목의 다른 Page가 있어 저장을 중단했습니다.");
}

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(['"])|(['"])$/g, "");
  }
}

function pageMarkdown(title, source, body) {
  return [`# ${title}`, source ? `> 원문. [Notion](${source})` : null, body].filter(Boolean).join("\n\n");
}

function buildRecords() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const oldPage = oldChatPageData;
  if (oldPage.title !== chatTitle || oldPage.source !== oldChatSource) {
    throw new Error("기존 ChatGPT Page 원문이 올바르지 않습니다.");
  }
  const input = [
    {
      title: oldPage.title,
      source: newChatSource,
      sourceAliases: [oldChatSource, newChatSource],
      exactDuplicateOnly: true,
      body: oldPage.notionContent,
    },
    ...newPageData.map((page) => ({
      ...page,
      sourceAliases: page.source ? [page.source] : [],
      exactDuplicateOnly: false,
    })),
  ];
  return input.map((page) => {
    const markdown = pageMarkdown(page.title, page.source, page.body);
    return { ...page, markdown, content: JSON.stringify(markdownToTiptapDoc(markdown)) };
  });
}

function assertContent(records) {
  const chat = records[0].body;
  const session = records[1].body;
  const blog = records[2].body;
  const marketer = records[3].body;
  const marketerPrompts = marketer.match(/^## (?:0[1-9]|10)\./gm) ?? [];
  const integrity = {
    records: records.length === 4,
    chatCommands: (chat.match(/^## .*?`\/[^`]+`/gm) ?? []).length === 40,
    sessionCommands: ["/list-agents", "/peers", "/rename", "/status", "crossSessionInbound", "SendMessage", "ListAgents", "isolatePeerMachines"].every((value) => session.includes(value)),
    sessionInstagram: session.includes("https://www.instagram.com/ai.trend.kr/"),
    blogSteps: [1, 2, 3, 4, 5].every((step) => blog.includes(`STEP ${step}.`)),
    blogSections: ["## 1단계. CTR 제목 20개 생성", "## 13단계. 최종 자체 검수", "## ① CTR 제목 후보 20개", "## ③ 네이버 홈피드용 최종 본문"].every((heading) => blog.includes(heading)),
    marketerPrompts: marketerPrompts.length === 10,
    marketerTable: marketer.includes("| 원칙 | 이걸 넣지 말고 | 이렇게 |"),
    marketerWarnings: ["고객 개인정보", "표시광고법", "페르소나는 가설"].every((value) => marketer.includes(value)),
    media: records.every((record) => !/data:image|blob:|<file\b|notion-week-image:/.test(record.content)),
    sources: records.every((record) => !record.source || record.content.includes(record.source)),
  };
  if (Object.values(integrity).some((value) => !value)) {
    throw new Error(`Page 원문 무결성 검증에 실패했습니다: ${JSON.stringify(integrity)}`);
  }
  return integrity;
}

function plansFor(rows, records) {
  return records.map((record) => ({ record, ...planNotionSessionMessagePage(rows, record) }));
}

function assertCompleteDuplicate(plans) {
  if (plans[0].action !== "skip") {
    throw new Error("기존 ChatGPT Page가 완비 중복이 아니므로 저장을 중단했습니다.");
  }
}

function localRows() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const rows = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  return rows;
}

async function allRows(query) {
  const rows = [];
  for (let from = 0; ; from += 100) {
    const { data, error } = await query.range(from, from + 99);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 100) return rows;
  }
}

function importLocal(records) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { inserted: 0, updated: 0, skipped: 0 };
  db.transaction(() => {
    const rows = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    const plans = plansFor(rows, records);
    assertCompleteDuplicate(plans);
    const insert = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    const update = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
    for (const { record, action, row } of plans) {
      const now = new Date().toISOString();
      if (action === "insert") {
        insert.run(randomUUID(), localUser, record.title, record.content, now, now);
        result.inserted += 1;
      } else if (action === "update") {
        update.run(record.content, now, row.id, localUser);
        result.updated += 1;
      } else {
        result.skipped += 1;
      }
    }
  })();
  db.close();
  return result;
}

async function importProduction(supabase, records, rows) {
  const plans = plansFor(rows, records);
  assertCompleteDuplicate(plans);
  const result = { inserted: 0, updated: 0, skipped: 0 };
  for (const { record, action, row } of plans) {
    const now = new Date().toISOString();
    if (action === "insert") {
      const { error } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: record.title, content: record.content, created_at: now, updated_at: now });
      if (error) throw error;
      result.inserted += 1;
    } else if (action === "update") {
      const { error } = await supabase.from("custom_pages").update({ content: record.content, updated_at: now }).eq("id", row.id).eq("user_id", productionUser);
      if (error) throw error;
      result.updated += 1;
    } else {
      result.skipped += 1;
    }
  }
  return result;
}

function verifyRows(rows, records) {
  const plans = plansFor(rows, records);
  if (plans.some((plan) => plan.action !== "skip")) {
    throw new Error("저장 Page 후검증에 실패했습니다.");
  }
  return { pages: plans.length, images: 0, attachments: 0 };
}

async function main() {
  loadEnv();
  const records = buildRecords();
  const integrity = assertContent(records);
  if (process.argv.includes("--check")) {
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
      if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
    }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const localPlans = plansFor(localRows(), records);
    assertCompleteDuplicate(localPlans);
    const productionPlans = plansFor(
      await allRows(supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser)),
      records
    );
    assertCompleteDuplicate(productionPlans);
    console.log(JSON.stringify({
      records: records.length,
      completeDuplicate: 1,
      writeCandidates: 3,
      images: 0,
      attachments: 0,
      writes: 0,
      integrity,
      preflight: {
        local: localPlans.map(({ action }) => action),
        production: productionPlans.map(({ action }) => action),
      },
      pages: records.map(({ title, markdown }) => ({ title, characters: markdown.length })),
    }, null, 2));
    return;
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const localPreflight = plansFor(localRows(), records);
  assertCompleteDuplicate(localPreflight);
  const productionRows = await allRows(supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser));
  const productionPreflight = plansFor(productionRows, records);
  assertCompleteDuplicate(productionPreflight);
  const local = importLocal(records);
  const production = await importProduction(supabase, records, productionRows);
  const verify = {
    local: verifyRows(localRows(), records),
    production: verifyRows(await allRows(supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser)), records),
  };
  console.log(JSON.stringify({ local, production, verify }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
