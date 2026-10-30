// REBORN Crawl4AI 안내 글을 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import { documentStats } from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const TRACKING_KEY = ["fb", "clid"].join("");

export const SOURCE_URL = "https://rebornlabs.kr/crawl4";
export const PAGE_TITLE = "웹을 AI가 읽기 좋은 마크다운으로 — Crawl4AI 안내";
export const REQUIRED_HREFS = [
  SOURCE_URL,
  "https://github.com/unclecode/crawl4ai",
  "https://rebornlabs.kr/skillpack",
];
export const REQUIRED_CODES = [
  "pip install -U crawl4ai\ncrawl4ai-setup\ncrawl4ai-doctor",
  "docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g -e CRAWL4AI_API_TOKEN=내토큰 unclecode/crawl4ai:latest",
  "claude mcp add --transport sse c4ai-sse http://localhost:11235/mcp/sse\nclaude mcp list",
];

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1].trim()]) process.env[match[1].trim()] = value;
  }
}

function dropsXShareQuery(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  return host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com");
}

function isTrackingParam(key, value, hostname) {
  return (
    key.startsWith("utm_") ||
    key === TRACKING_KEY ||
    key === "pvs" ||
    key === "igsh" ||
    key === "gclid" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1") ||
    (key === "from" && ["dm", "littly", "guide"].includes(value)) ||
    (key === "s" && dropsXShareQuery(hostname))
  );
}

/** 유입 추적 쿼리를 빼고 http는 https로 바꾼다. localhost는 http로 남긴다. */
export function stripTracking(url, base = SOURCE_URL) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) return url;
  try {
    const parsed = new URL(url, base);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol === "http:" && !local) parsed.protocol = "https:";
    for (const key of [...parsed.searchParams.keys()]) {
      if (isTrackingParam(key, parsed.searchParams.get(key), parsed.hostname)) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    parsed.hash = "";
    return parsed.href;
  } catch {
    return String(url);
  }
}

/** 제목 또는 원문 주소가 같으면 중복이다. 본문 언급은 중복이 아니다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const raw = String(row.source_url || "").trim();
  if (!raw) return false;
  const source = stripTracking(raw).replace(/\/+$/, "");
  return markers.some((marker) => source === stripTracking(marker).replace(/\/+$/, ""));
}

function plain(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function codeText($, el) {
  const clone = $(el).clone();
  clone.find("br").replaceWith("\n");
  return clone.text().replace(/\r\n/g, "\n").trim();
}

function inlineText($, el) {
  const clone = $(el).clone();
  clone.find("br").replaceWith(" ");
  clone.find("a").each((_, link) => {
    const href = stripTracking($(link).attr("href") || "");
    const label = plain($(link).text());
    $(link).replaceWith(label && href ? `[${label}](${href})` : label);
  });
  clone.find("b, strong").each((_, node) => {
    const label = plain($(node).text());
    $(node).replaceWith(label ? `**${label}**` : "");
  });
  return plain(clone.text());
}

/** 헤더와 추적 쿼리를 빼고 본문 마크다운을 만든다. */
export function pageFromHtml(html) {
  const $ = cheerio.load(html);
  $("header.top, script, style").remove();
  const title = plain($("title").text().split("|")[0]);
  if (title !== PAGE_TITLE) throw new Error(`제목이 다릅니다. ${title}`);
  const parts = [`# ${PAGE_TITLE}`, `> 원문. [REBORN LABS](${SOURCE_URL})`, ""];
  const hero = $("section.hero");
  const headline = hero.find("h1").first().clone();
  headline.find("br").replaceWith(" ");
  const headlineText = plain(headline.text());
  if (headlineText) parts.push(headlineText, "");
  const badges = hero
    .find(".badge")
    .map((_, el) => plain($(el).text()))
    .get()
    .filter(Boolean);
  hero.find(".badge").remove();
  hero.find("p").each((_, el) => {
    const text = inlineText($, el);
    if (text) parts.push(text, "");
  });
  if (badges.length) parts.push(badges.join(" · "), "");

  $("section.sec, section.bottom").each((_, section) => {
    const node = $(section);
    const heading = plain(node.find("h2").first().text());
    if (heading) parts.push(`## ${heading}`, "");
    node.children().each((__, child) => {
      const el = $(child);
      if (el.is("h2")) return;
      if (el.is("p")) {
        const text = inlineText($, el);
        if (text) parts.push(text, "");
        return;
      }
      if (el.hasClass("cards")) {
        el.find(".card").each((___, card) => {
          const cardTitle = plain($(card).find(".k").text());
          const body = plain($(card).find("p").text());
          if (cardTitle) parts.push(`### ${cardTitle}`, "");
          if (body) parts.push(body, "");
        });
        return;
      }
      if (el.hasClass("cmd")) {
        const code = codeText($, el.find("code").get(0) || child);
        parts.push("```", code, "```", "");
        return;
      }
      if (el.hasClass("defs")) {
        el.children("div").each((___, row) => {
          const label = plain($(row).find("b").text());
          const value = plain($(row).find("span").text());
          if (label && value) parts.push(`**${label}** ${value}`, "");
        });
      }
    });
  });
  return `${parts.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function assertIntegrity(markdown, content) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) throw new Error("첫 헤딩이 제목과 다릅니다.");
  if (!markdown.includes(SOURCE_URL)) throw new Error("원문 주소가 없습니다.");
  if (markdown.includes("utm_") || markdown.includes(TRACKING_KEY)) {
    throw new Error("추적 쿼리가 본문에 남아 있습니다.");
  }
  if (markdown.includes("리본랩스 스킬팩")) throw new Error("상단 메뉴가 본문에 남아 있습니다.");
  for (const code of REQUIRED_CODES) {
    if (!markdown.includes(code)) throw new Error("설치 명령이 없습니다.");
  }
  if (markdown.includes("https://localhost:11235")) throw new Error("localhost가 https로 바뀌었습니다.");
  const stats = documentStats(content);
  if (stats.images !== 0) throw new Error(`이미지 수가 다릅니다. ${stats.images}`);
  if (stats.attachments !== 0) throw new Error(`첨부 수가 다릅니다. ${stats.attachments}`);
  if (stats.codes !== REQUIRED_CODES.length) throw new Error(`코드 수가 다릅니다. ${stats.codes}`);
  const hrefs = new Set(stats.hrefs.map((href) => stripTracking(href).replace(/\/+$/, "")));
  for (const href of REQUIRED_HREFS) {
    if (!hrefs.has(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
  const codeTextJoined = JSON.stringify(
    (() => {
      const found = [];
      const walk = (node) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "codeBlock") found.push(node.content?.map((child) => child.text || "").join("") || "");
        for (const child of node.content ?? []) walk(child);
      };
      walk(JSON.parse(content));
      return found;
    })(),
  );
  if (!codeTextJoined.includes("http://localhost:11235/mcp/sse")) {
    throw new Error("코드 안의 localhost가 없습니다.");
  }
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts"),
  );
  return { markdownToTiptapDoc, preparePageFindability, isMissingPageFindabilityColumn };
}

async function buildImportedPage(libs) {
  const response = await fetch(SOURCE_URL, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  const markdown = pageFromHtml(await response.text());
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  assertIntegrity(markdown, content);
  const stats = documentStats(content);
  return {
    pageTitle: PAGE_TITLE,
    sourceUrl: SOURCE_URL,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    codes: stats.codes,
    links: stats.links,
    length: content.length,
    hash: createHash("sha256").update(content).digest("hex"),
    content,
  };
}

function pageColumns(db) {
  return db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
}

function findLocalPage(db) {
  const cols = pageColumns(db);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const byTitle = db
    .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ?`)
    .get(LOCAL_USER, PAGE_TITLE);
  if (isDuplicateRow(byTitle, PAGE_TITLE, [SOURCE_URL])) return byTitle;
  if (!cols.includes("source_url")) return null;
  const bySource = db
    .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1`)
    .get(LOCAL_USER, SOURCE_URL);
  if (isDuplicateRow(bySource, PAGE_TITLE, [SOURCE_URL])) return bySource;
  return null;
}

function findabilityOf(libs, page) {
  const found = libs.preparePageFindability({
    title: page.title,
    content: page.content,
    existingSourceUrl: page.sourceUrl,
  });
  return {
    tags: JSON.stringify(found.tags ?? []),
    sourceUrl: found.sourceUrl || page.sourceUrl,
    searchText: found.searchText ?? "",
  };
}

function sqliteHasFindability(db) {
  const cols = pageColumns(db);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) => cols.includes(name));
}

function importLocal(page, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    db.close();
    return result;
  }
  const found = findabilityOf(libs, page);
  if (sqliteHasFindability(db)) {
    db.prepare(
      `INSERT INTO custom_pages (
         id, user_id, title, content, tags, source_url, search_text, is_favorite, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      found.tags,
      found.sourceUrl,
      found.searchText,
      page.created_at,
      page.updated_at,
    );
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(page.id, LOCAL_USER, page.title, page.content, page.created_at, page.updated_at);
  }
  result.pages += 1;
  db.close();
  return result;
}

function createSupabase() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function findProductionPage(supabase) {
  const byTitle = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("title", PAGE_TITLE)
    .limit(1);
  if (byTitle.error) throw byTitle.error;
  if (isDuplicateRow(byTitle.data?.[0], PAGE_TITLE, [SOURCE_URL])) return byTitle.data[0];
  const bySource = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("source_url", SOURCE_URL)
    .limit(1);
  if (bySource.error) throw bySource.error;
  if (isDuplicateRow(bySource.data?.[0], PAGE_TITLE, [SOURCE_URL])) return bySource.data[0];
  return null;
}

async function importProduction(page, libs) {
  const supabase = createSupabase();
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    return result;
  }
  const found = findabilityOf(libs, page);
  const full = {
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    tags: found.tags,
    source_url: found.sourceUrl,
    search_text: found.searchText,
    is_favorite: 0,
    created_at: page.created_at,
    updated_at: page.updated_at,
  };
  const { error: insertError } = await supabase.from("custom_pages").insert(full);
  if (insertError) {
    const missing =
      libs.isMissingPageFindabilityColumn(insertError.message) ||
      /(tags|source_url|search_text|is_favorite)/i.test(insertError.message);
    if (!missing) throw insertError;
    const { error: retryError } = await supabase.from("custom_pages").insert({
      id: page.id,
      user_id: PROD_USER,
      title: page.title,
      content: page.content,
      created_at: page.created_at,
      updated_at: page.updated_at,
    });
    if (retryError) throw retryError;
  }
  result.pages += 1;
  return result;
}

async function savedOnBothSides() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let local = null;
  try {
    local = findLocalPage(db);
  } finally {
    db.close();
  }
  const production = await findProductionPage(createSupabase());
  if (!local && !production) return null;
  if (!local || !production) throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${SOURCE_URL}`);
  if (local.id !== production.id) throw new Error(`로컬과 운영의 페이지 id가 다릅니다. ${SOURCE_URL}`);
  return { pageId: local.id, path: `/pages/${local.id}`, action: "skip" };
}

function emit(value) {
  const output = JSON.stringify(value, null, 2);
  if (output.includes("data:")) throw new Error("로그에 data URL이 있습니다.");
  if (output.includes(TRACKING_KEY) || output.includes("utm_source")) {
    throw new Error("로그에 추적 쿼리가 있습니다.");
  }
  console.log(output);
}

async function main() {
  loadEnv();
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  if (!checkOnly) {
    const saved = await savedOnBothSides();
    if (saved) {
      emit(saved);
      return;
    }
  }
  const built = await buildImportedPage(libs);
  const { content, ...extra } = built;
  if (checkOnly) {
    emit(extra);
    return;
  }
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: PAGE_TITLE,
    content,
    sourceUrl: SOURCE_URL,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, libs);
  record.id = local.pageId;
  let production;
  try {
    production = await importProduction(record, libs);
  } catch (error) {
    if (local.pages === 1) {
      const db = new Database(resolve(root, "data/mymark.db"));
      db.prepare("DELETE FROM custom_pages WHERE id = ? AND user_id = ?").run(record.id, LOCAL_USER);
      db.close();
    }
    throw error;
  }
  const pageId = production.pageId || local.pageId;
  emit({
    ...extra,
    pageId,
    path: `/pages/${pageId}`,
    createdAt: now,
    local: { action: local.pages ? "insert" : "skip", pages: local.pages, pageSkips: local.pageSkips },
    production: {
      action: production.pages ? "insert" : "skip",
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  });
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) await main();
