// 노시언 노션템플릿 하위 원문과 컬렉션 데이터를 Pages와 재사용 프롬프트로 저장한다
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { pageData as batchOne } from "./notion-nosian-templates-202608-1.mjs";
import { pageData as batchTwo } from "./notion-nosian-templates-202608-2.mjs";
import { pageData as batchThree } from "./notion-nosian-templates-202608-3.mjs";
import { pageData as batchFour } from "./notion-nosian-templates-202608-4.mjs";
import { databaseData } from "./notion-nosian-templates-202608-databases.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const pageData = [...batchOne, ...batchTwo, ...batchThree, ...batchFour];

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(["'])|(["'])$/g, "");
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
const { normalizePasteToMarkdown } = require(resolve(root, "src/lib/normalize-to-markdown.ts"));

function contentFromNotion(text) {
  return (text.match(/<content>\n([\s\S]*?)\n<\/content>/)?.[1] ?? text).trim();
}

function preserveNotionReferences(value) {
  return value
    .replace(/<(page|database)\b([^>]*)>([\s\S]*?)<\/\1>/g, (_match, tag, attributes, label) => {
      const url = attributes.match(/\burl="([^"]+)"/)?.[1];
      return url ? `[${label.trim() || tag}](${url})` : label;
    })
    .replace(/<(unknown(?:_mention)?)\b([^>]*)\/>/g, (_match, _tag, attributes) => {
      const url = attributes.match(/\burl="([^"]+)"/)?.[1];
      const label = attributes.match(/\balt="([^"]+)"/)?.[1] ?? "참조";
      return url ? `[${label}](${url})` : "";
    });
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTitle(value) {
  return value.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\s]+/u, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function pageFingerprint(content) {
  try {
    const doc = JSON.parse(content);
    return createHash("sha256").update(JSON.stringify((doc.content ?? []).slice(2))).digest("hex");
  } catch {
    return "";
  }
}

function promptBody(sections) {
  try {
    return JSON.parse(sections).find((section) => section.title === "프롬프트")?.body ?? "";
  } catch {
    return "";
  }
}

function linkCount(content) {
  return content.match(/"type":"link"/g)?.length ?? 0;
}

function databaseMarkdown(database) {
  const rows = database.rows.map((row) => {
    const name = String(row["이름"] ?? "이름 없는 행").replace(/[\[\]]/g, "");
    return `## [${name}](${row.url})\n\n\`\`\`json\n${JSON.stringify(row, null, 2)}\n\`\`\``;
  }).join("\n\n");
  return [`# 📝 노시언 DB · ${database.title}`, `> 원문. [Notion](${database.source})`, `> collection. [Notion](${database.collection})`, rows].join("\n\n");
}

const pageRecords = pageData.map((page) => {
  const sourceBody = contentFromNotion(page.notionContent);
  const body = normalizePasteToMarkdown(preserveNotionReferences(sourceBody)).trim();
  const title = `📝 노시언 · ${page.title}`;
  const content = JSON.stringify(markdownToTiptapDoc([`# ${title}`, `> 원문. [Notion](${page.source})`, body].join("\n\n")));
  return {
    ...page,
    title,
    body,
    content,
    fingerprint: pageFingerprint(content),
    prompts: page.promptBodies.map((body, index) => ({
      title: `${title} · 프롬프트 ${String(index + 1).padStart(2, "0")}`,
      category: "Notion · 노시언 템플릿",
      summary: "Notion 원문에서 복사해 재사용하는 프롬프트입니다.",
      when_to_use: "원문 주제에 맞는 작업을 AI에게 요청할 때 사용하세요.",
      sections: JSON.stringify([{ title: "프롬프트", body }, { title: "관련 Page", body: title }, { title: "원문 Notion", body: page.source }]),
    })),
  };
});

const databaseRecords = databaseData.map((database) => {
  const body = databaseMarkdown(database);
  const content = JSON.stringify(markdownToTiptapDoc(body));
  return { id: database.collection, title: `📝 노시언 DB · ${database.title}`, source: database.source, collection: database.collection, rowCount: database.rows.length, sourceToggles: 0, sourceUnknowns: 0, sourceReferences: 0, sourceImages: 0, body, content, fingerprint: pageFingerprint(content), prompts: [] };
});

const records = [...pageRecords, ...databaseRecords];
const totals = {
  childPages: pageRecords.length,
  databasePages: databaseRecords.length,
  databaseRows: databaseRecords.reduce((sum, record) => sum + record.rowCount, 0),
  pages: records.length,
  prompts: records.reduce((sum, record) => sum + record.prompts.length, 0),
  toggles: pageRecords.reduce((sum, record) => sum + record.sourceToggles, 0),
  images: records.reduce((sum, record) => sum + (record.content.match(/"type":"image"/g)?.length ?? 0), 0),
  links: records.reduce((sum, record) => sum + linkCount(record.content), 0),
  unknowns: pageRecords.reduce((sum, record) => sum + record.sourceUnknowns, 0),
  references: pageRecords.reduce((sum, record) => sum + record.sourceReferences, 0),
};

if (
  totals.childPages !== 44 || totals.databasePages !== 2 || totals.databaseRows !== 508 || totals.pages !== 46 || totals.prompts !== 3 || totals.images !== 196 ||
  new Set(records.map((record) => normalizeTitle(record.title))).size !== totals.pages ||
  records.some((record) => !record.body || !record.content.includes(record.source) || !record.fingerprint) ||
  pageRecords.some((record) => record.content.includes("prod-files-secure") || linkCount(record.content) < record.sourceReferences + 1) ||
  databaseRecords.some((record) => !record.content.includes(record.collection))
) throw new Error("Notion 원문, 컬렉션, 프롬프트 또는 이미지 무결성 검증에 실패했습니다.");

if (process.argv.includes("--check")) {
  console.log(JSON.stringify({
    pages: records.map((record) => ({ title: record.title, source: record.source, toggles: record.sourceToggles, images: record.content.match(/"type":"image"/g)?.length ?? 0, links: linkCount(record.content), unknowns: record.sourceUnknowns, prompts: record.prompts.length, rows: record.rowCount ?? 0 })),
    totals,
    unknownBlockLimitation: "Notion fetch의 unknown bookmark/button은 원문이 제공한 source page#block 링크와 표시명을 보존했으며, 제공되지 않은 외부 대상 URL은 추정하지 않았습니다.",
  }, null, 2));
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
}

function pageExists(rows, record) {
  return rows.some((row) => normalizeTitle(row.title) === normalizeTitle(record.title) || pageFingerprint(row.content) === record.fingerprint);
}

function promptExists(rows, prompt) {
  const body = normalizeText(promptBody(prompt.sections));
  return rows.some((row) => (row.title === prompt.title && row.category === prompt.category) || (body && normalizeText(promptBody(row.sections)) === body));
}

const now = new Date().toISOString();

function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pagesInserted: 0, pagesSkipped: 0, promptsInserted: 0, promptsSkipped: 0 };
  const transaction = db.transaction(() => {
    const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    const prompts = db.prepare("SELECT title, category, sections FROM prompts WHERE user_id = ?").all(localUser);
    const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
    for (const record of records) {
      if (pageExists(pages, record)) result.pagesSkipped += 1;
      else { insertPage.run(randomUUID(), localUser, record.title, record.content, now, now); pages.push({ title: record.title, content: record.content }); result.pagesInserted += 1; }
      for (const prompt of record.prompts) {
        if (promptExists(prompts, prompt)) result.promptsSkipped += 1;
        else { insertPrompt.run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now); prompts.push(prompt); result.promptsInserted += 1; }
      }
    }
  });
  transaction();
  db.close();
  return result;
}

async function allRows(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function importProduction() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const result = { pagesInserted: 0, pagesSkipped: 0, promptsInserted: 0, promptsSkipped: 0 };
  const pages = await allRows(supabase.from("custom_pages").select("title, content").eq("user_id", productionUser));
  const prompts = await allRows(supabase.from("prompts").select("title, category, sections").eq("user_id", productionUser));
  for (const record of records) {
    if (pageExists(pages, record)) result.pagesSkipped += 1;
    else {
      const { error } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: record.title, content: record.content, created_at: now, updated_at: now });
      if (error) throw error;
      pages.push({ title: record.title, content: record.content });
      result.pagesInserted += 1;
    }
    for (const prompt of record.prompts) {
      if (promptExists(prompts, prompt)) result.promptsSkipped += 1;
      else {
        const { error } = await supabase.from("prompts").insert({ id: randomUUID(), user_id: productionUser, title: prompt.title, category: prompt.category, summary: prompt.summary, when_to_use: prompt.when_to_use, sections: prompt.sections, is_favorite: 0, created_at: now, updated_at: now });
        if (error) throw error;
        prompts.push(prompt);
        result.promptsInserted += 1;
      }
    }
  }
  return result;
}

function verifyRows(pages, prompts) {
  const matches = records.map((record) => pages.find((page) => normalizeTitle(page.title) === normalizeTitle(record.title)));
  const promptMatches = records.reduce((sum, record) => sum + record.prompts.filter((prompt) => promptExists(prompts, prompt)).length, 0);
  const sourceMatches = matches.filter((page, index) => page?.content.includes(records[index].source)).length;
  const imageMatches = matches.reduce((sum, page) => sum + (page?.content.match(/"type":"image"/g)?.length ?? 0), 0);
  const referencesPreserved = pageRecords.every((record, index) => linkCount(matches[index]?.content ?? "") >= record.sourceReferences + 1);
  const collectionRowsPreserved = databaseRecords.every((record, index) => {
    const page = matches[pageRecords.length + index];
    return page?.content.includes(record.collection) && databaseData[index].rows.every((row) => page.content.includes(row.url));
  });
  if (matches.some((page, index) => !page || page.content !== records[index].content) || promptMatches !== totals.prompts || sourceMatches !== totals.pages || imageMatches !== totals.images || !referencesPreserved || !collectionRowsPreserved) throw new Error("저장 DB 검증에 실패했습니다.");
  return { pages: matches.length, childPages: totals.childPages, databasePages: totals.databasePages, databaseRows: totals.databaseRows, prompts: promptMatches, images: imageMatches, sources: sourceMatches, links: matches.reduce((sum, page) => sum + linkCount(page.content), 0), unknowns: totals.unknowns };
}

function localVerification() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  const prompts = db.prepare("SELECT title, category, sections FROM prompts WHERE user_id = ?").all(localUser);
  const result = verifyRows(pages, prompts);
  db.close();
  return result;
}

const local = importLocal();
const production = await importProduction();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const productionPages = await allRows(supabase.from("custom_pages").select("title, content").eq("user_id", productionUser));
const productionPrompts = await allRows(supabase.from("prompts").select("title, category, sections").eq("user_id", productionUser));
console.log(JSON.stringify({ local, production, verify: { local: localVerification(), production: verifyRows(productionPages, productionPrompts) } }, null, 2));
