// 스케일메이커 클로드 공식 스킬 19개 정리를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { documentStats } from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_ORIGIN = "https://scalemaker.co";

export const SOURCE_URL =
  "https://scalemaker.co/g/2026-10-02-claude-official-skills";
export const PAGE_TITLE = "클로드 공식 스킬 19개 총정리 + 켜는 법";
export const EXPECTED_IMAGES = 0;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_CODES = 4;
export const EXPECTED_TABLES = 0;

const REQUIRED_PHRASES = [
  "@ai_leeseul 정리본 · 2026-10-02",
  "1. claude.ai에서 스킬 켜는 법",
  "2. 클로드코드에 설치하는 법",
  "3. 문서 4종 (가장 많이 쓰는 스킬)",
  "4. 글쓰기·업무",
  "5. 디자인",
  "6. 개발·기술 (개발자용)",
  "7. 그 밖의 스킬",
  "8. 잘 쓰는 팁",
  "AI로 직접 수익까지 만들고 싶다면",
  "/plugin marketplace add anthropics/skills",
  "[파일 첨부] 이 PDF의 표를 전부 뽑아서 엑셀 시트로 만들어줘",
];
const REQUIRED_HREFS = [
  SOURCE_URL,
  "https://github.com/anthropics/skills",
  "https://support.claude.com/en/articles/12512180-using-skills-in-claude",
  "https://scalemaker.co/courses",
  "https://www.instagram.com/ai_leeseul/",
];
const FORBIDDEN = [
  "fbclid",
  "/brand/logo",
  "og/main.jpg",
  "이용약관",
  "개인정보처리방침",
  "pf.kakao.com",
  "https://www.youtube.com/",
];
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "X-Amz",
  "expirationTimestamp",
  "blob:",
];
const DROP_REF_PARTS = ["/brand/logo", "og/main.jpg", "pf.kakao.com", "youtube.com"];

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const k = match[1].trim();
    let v = match[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

/** 추적 쿼리를 지우고 http는 https로 올린다. data URL은 그대로 둔다. */
export function stripTracking(url, base) {
  const value = String(url ?? "");
  if (!value || value.startsWith("data:")) return value;
  try {
    const parsed = new URL(value, base || SITE_ORIGIN);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    for (const key of [...parsed.searchParams.keys()]) {
      const param = parsed.searchParams.get(key);
      if (
        key.startsWith("utm_") ||
        key === "fbclid" ||
        key === "pvs" ||
        key === "mcp_token" ||
        (key === "from" && param === "dm") ||
        (key === "source" && param === "copy_link")
      ) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return value
      .replace(/^http:\/\//i, "https://")
      .replace(/[?&](?:utm_[^=&#]*|fbclid|pvs|mcp_token)=[^&\s)#]*/gi, "")
      .replace(/[?&]from=dm(?=[&#]|$)/g, "")
      .replace(/[?&]source=copy_link(?=[&#]|$)/g, "")
      .replace(/\?&/g, "?")
      .replace(/[?&]$/, "");
  }
}

/** 제목 또는 원문 주소가 정확히 같으면 중복이다. 비슷한 제목은 중복이 아니다. */
export function isDuplicateRow(row, title, sourceUrl) {
  if (!row) return false;
  if (row.title === title) return true;
  const markers = Array.isArray(sourceUrl) ? sourceUrl : [sourceUrl];
  return markers.some((marker) => Boolean(marker) && row.source_url === marker);
}

function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return {
    markdownToTiptapDoc,
    preparePageFindability,
    isMissingPageFindabilityColumn,
  };
}

function toAbsoluteUrl(url) {
  if (!url) return url;
  if (String(url).startsWith("data:")) return url;
  if (/^(https?:|mailto:)/i.test(url)) return stripTracking(url);
  try {
    return stripTracking(new URL(url, SITE_ORIGIN).href);
  } catch {
    return url;
  }
}

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.addRule("preToFence", {
    filter: "pre",
    replacement(_inner, node) {
      const text = String(node.textContent || "").replace(/\n$/, "");
      return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    },
  });
  return turndown;
}

/** ol 단계 목록의 li 자식을 꺼내 제목이 목록 안에 남지 않게 한다. */
function liftStepList($, content) {
  content.find("ol").each((_, ol) => {
    const list = $(ol);
    const parts = [];
    list.children("li").each((__, li) => {
      const item = $(li);
      item.children("span").each((___, span) => {
        if (/^\d{2}$/.test($(span).text().trim())) $(span).remove();
      });
      parts.push(item.html() || "");
    });
    list.before(parts.join(""));
    list.remove();
  });
}

/** 펜스 밖에서 Turndown 이스케이프를 되돌리고 날짜 줄 앞에 폭 없는 공백을 붙인다. */
function finishMarkdown(markdown) {
  const lines = String(markdown ?? "").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^```/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const restored = line.replace(/\\_/g, "_").replace(/\\\./g, ".");
      if (/^\d{4}\.\s+\d{1,2}\.\s+\d{1,2}\./.test(restored)) {
        return `\u200B${restored}`;
      }
      return restored;
    })
    .join("\n");
}

/** 가져온 HTML에서 저장용 마크다운을 만든다. 네트워크는 쓰지 않는다. */
export function articleMarkdownFromHtml(html) {
  const $ = cheerio.load(String(html ?? ""));
  const content = $("main").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");

  content.find("header, footer, nav, button, script, style, noscript").remove();
  content.find("a[href], img[src]").each((_, el) => {
    const node = $(el);
    const ref = `${node.attr("href") || ""} ${node.attr("src") || ""}`;
    if (DROP_REF_PARTS.some((part) => ref.includes(part))) node.remove();
  });
  content.find("img").remove();
  liftStepList($, content);
  content.find("h1").each((_, el) => {
    if ($(el).text().replace(/\s+/g, " ").trim() === PAGE_TITLE) $(el).remove();
  });
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    $(link).attr("href", toAbsoluteUrl(href));
  });

  const body = finishMarkdown(createTurndown().turndown(content.html() || ""));
  return [
    `# ${PAGE_TITLE}`,
    `> 원문. [스케일메이커](${SOURCE_URL})`,
    body.trim(),
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function assertIntegrity(markdown, content, stats) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(SOURCE_URL) || !content.includes(SOURCE_URL)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`본문 이미지가 ${EXPECTED_IMAGES}장이 아닙니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`첨부가 ${EXPECTED_ATTACHMENTS}개가 아닙니다. ${stats.attachments}`);
  }
  if (stats.codes !== EXPECTED_CODES) {
    throw new Error(`코드 블록이 ${EXPECTED_CODES}개가 아닙니다. ${stats.codes}`);
  }
  if (stats.tables !== EXPECTED_TABLES) {
    throw new Error(`표가 ${EXPECTED_TABLES}개가 아닙니다. ${stats.tables}`);
  }
  for (const href of REQUIRED_HREFS) {
    if (!stats.hrefs.includes(href)) throw new Error(`TipTap 링크가 없습니다. ${href}`);
  }
  for (const forbidden of FORBIDDEN) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  const firstFence = markdown.match(/```\n([\s\S]*?)\n```/);
  const firstLines = (firstFence?.[1] || "").split("\n");
  if (
    firstLines.length !== 2 ||
    firstLines[0] !== "/plugin marketplace add anthropics/skills" ||
    firstLines[1] !== "/plugin install document-skills@anthropic-agent-skills"
  ) {
    throw new Error("첫 코드 블록이 설치 명령 두 줄이 아닙니다.");
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

async function buildImportedPage(libs) {
  const html = await fetchText(SOURCE_URL);
  const markdown = articleMarkdownFromHtml(html);
  const pageContent = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(pageContent);
  assertIntegrity(markdown, pageContent, stats);
  return {
    markdown,
    content: pageContent,
    images: stats.images,
    attachments: stats.attachments,
    codes: stats.codes,
    tables: stats.tables,
  };
}

function pageAction(result) {
  if (result.pages) return "insert";
  return "skip";
}

function sqliteHasFindability(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((c) => c.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((n) =>
    cols.includes(n)
  );
}

function pageColumns(db) {
  return db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((c) => c.name);
}

function markersOf() {
  return [SOURCE_URL];
}

function findLocalPage(db, title, markers) {
  const cols = pageColumns(db);
  const fields = ["id", "title", "content"];
  if (cols.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const byTitle = db
    .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ?`)
    .get(LOCAL_USER, title);
  if (isDuplicateRow(byTitle, title, markers)) return byTitle;
  if (cols.includes("source_url")) {
    for (const marker of markers) {
      if (!marker) continue;
      const row = db
        .prepare(
          `SELECT ${select} FROM custom_pages
           WHERE user_id = ? AND source_url = ?
           LIMIT 1`
        )
        .get(LOCAL_USER, marker);
      if (isDuplicateRow(row, title, markers)) return row;
    }
  }
  return null;
}

function findabilityOf(libs, page) {
  const found = libs.preparePageFindability({
    title: page.title,
    content: page.content,
    existingSourceUrl: SOURCE_URL,
  });
  return {
    tags: JSON.stringify(found.tags ?? []),
    sourceUrl: found.sourceUrl || SOURCE_URL,
    searchText: found.searchText ?? "",
  };
}

function importLocal(page, markers, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title, markers);
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      found.tags,
      found.sourceUrl,
      found.searchText,
      page.created_at,
      page.updated_at
    );
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      page.created_at,
      page.updated_at
    );
  }
  result.pages += 1;
  db.close();
  return result;
}

async function findProductionPage(supabase, title, sourceUrl) {
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return data[0];
  if (!sourceUrl) return null;
  try {
    const bySource = await supabase
      .from("custom_pages")
      .select("id, title")
      .eq("user_id", PROD_USER)
      .eq("source_url", sourceUrl)
      .limit(1);
    if (bySource.error) {
      if (!/source_url/i.test(bySource.error.message)) throw bySource.error;
      return null;
    }
    return bySource.data?.[0] ?? null;
  } catch (error) {
    if (/source_url/i.test(String(error?.message ?? error))) return null;
    throw error;
  }
}

async function importProduction(page, libs) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page.title, page.sourceUrl);
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

async function main() {
  const libs = loadLibs();
  const imported = await buildImportedPage(libs);
  if (process.argv.includes("--check")) {
    console.log(
      JSON.stringify(
        {
          pageTitle: PAGE_TITLE,
          images: imported.images,
          attachments: imported.attachments,
          codes: imported.codes,
          tables: imported.tables,
        },
        null,
        2
      )
    );
    return;
  }

  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: PAGE_TITLE,
    content: imported.content,
    sourceUrl: SOURCE_URL,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markersOf(), libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  const pageId = production.pageId || local.pageId;
  console.log(
    JSON.stringify(
      {
        local: {
          action: pageAction(local),
          pages: local.pages,
          pageSkips: local.pageSkips,
        },
        production: {
          action: pageAction(production),
          pages: production.pages,
          pageSkips: production.pageSkips,
        },
        pageId,
        path: `/pages/${pageId}`,
        images: imported.images,
        attachments: imported.attachments,
        codes: imported.codes,
        tables: imported.tables,
        pageTitle: PAGE_TITLE,
      },
      null,
      2
    )
  );
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
