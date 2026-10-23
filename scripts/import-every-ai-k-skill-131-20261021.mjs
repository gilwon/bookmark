// every._ai k-skill 131개 설치 가이드를 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { documentStats } from "./import-claude-eli5-page.mjs";
import { isDuplicateRow, stripTracking } from "./import-every-ai-court-council-20261021.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_NAME = "every._ai";

export const SOURCE_URL =
  "https://every-ai-guides.vercel.app/posts/k-skill-131-korea";
export const PAGE_TITLE =
  "한국인이면 무조건 쓰게 될 k-skill 131개 설치 가이드";
export const EXPECTED = { images: 0, attachments: 0, tables: 2, codes: 5 };
export const HREFS = [
  SOURCE_URL,
  "https://github.com/NomaDamas/k-skill",
  "https://github.com/NomaDamas/k-skill/blob/main/docs/install.md",
  "https://github.com/NomaDamas/k-skill/blob/main/docs/setup.md",
  "https://code.claude.com/docs/en/plugin-marketplaces",
  "https://code.claude.com/docs/en/skills",
];
const PHRASES = [
  "2026-10-21",
  "/plugin marketplace add NomaDamas/k-skill",
  "/plugin install k-skill@k-skill",
  "npx --yes skills add NomaDamas/k-skill --all -g",
  "real-estate-search",
  "이동·교통·여행",
  "STEP 1 · 1분 클로드 코드에 k-skill 마켓플레이스를 등록한다",
];
const FORBIDDEN = [
  "수익화 노하우",
  "카톡방",
  "kakao",
  "from=guide",
  "from=dm",
  "instagram.com/every",
  "함께 보면 좋은 글",
  "claude-skills-388-staff",
  "sb_publishable",
  "utm_source",
];

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
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function plainText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function pageTitleOf($) {
  return plainText($("article.post h1").first().text()).replace(
    /\s*[—–-]\s*every\._ai\s*$/i,
    ""
  );
}

function stripChrome($, root) {
  root
    .find(
      "a.bootcamp-post-banner, .challenge-post-banner, a.challenge-post-banner, a.kakao-post-cta, section.challenge-banner, nav, footer, button, script, style, noscript, img, a[href*='youtube.com'], a[href*='instagram.com/every']"
    )
    .remove();
  root.find("h2").each((_, heading) => {
    const node = $(heading);
    if (plainText(node.text()) !== "함께 보면 좋은 글") return;
    node.next("ul").remove();
    node.remove();
  });
}

function separateStepSpans($, root) {
  root.find("h2 span.n").each((_, span) => {
    const next = span.nextSibling;
    if (!next) return;
    if (next.type === "text" && /^\s/.test(String(next.data ?? ""))) return;
    $(span).after(" ");
  });
}

function separateMetaSpans($, root) {
  root.find("div.sub span + span").each((_, span) => {
    $(span).before(" ");
  });
}

function rewriteLinks($, root) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:") || href.startsWith("mailto:")) return;
    $(link).attr("href", stripTracking(href, SOURCE_URL));
  });
}

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.addRule("tables", {
    filter: "table",
    replacement(_content, table) {
      const $table = cheerio.load(table.outerHTML || "<table></table>");
      const rows = [];
      $table("tr").each((_, tr) => {
        const cells = [];
        $table(tr)
          .find("th, td")
          .each((__, cell) => {
            cells.push(
              $table(cell).text().replace(/\s+/g, " ").replace(/\|/g, "\\|").trim()
            );
          });
        if (cells.length) rows.push(cells);
      });
      if (!rows.length) return "";
      const divider = rows[0].map(() => "---");
      return `\n\n${[rows[0], divider, ...rows.slice(1)]
        .map((row) => `| ${row.join(" | ")} |`)
        .join("\n")}\n\n`;
    },
  });
  turndown.addRule("barePre", {
    filter: "pre",
    replacement(_content, node) {
      const code = String(node.textContent || "").replace(/\n$/, "");
      const fence = code.includes("```") ? "````" : "```";
      return `\n\n${fence}\n${code}\n${fence}\n\n`;
    },
  });
  return turndown;
}

function cleanWebMarkdown(markdown) {
  return String(markdown ?? "")
    .replace(/\\([\[\]\.])/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTracking(path, SOURCE_URL)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url, SOURCE_URL))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** k-skill 가이드 HTML을 저장용 마크다운으로 바꾼다. */
export function articleMarkdownFromHtml(html) {
  const $ = cheerio.load(html);
  const article = $("article.post").first();
  if (!article.length) throw new Error("본문 영역 article.post 를 찾지 못했습니다.");
  const title = pageTitleOf($);
  if (title !== PAGE_TITLE) throw new Error(`제목이 다릅니다. ${title}`);
  const content = article.clone();
  stripChrome($, content);
  separateMetaSpans($, content);
  separateStepSpans($, content);
  content.find("h1").remove();
  rewriteLinks($, content);
  const body = cleanWebMarkdown(createTurndown().turndown(content.html() || ""));
  return [`# ${title}`, `> 원문. [${SITE_NAME}](${SOURCE_URL})`, body]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function assertPage(markdown, content) {
  const plain = `${markdown}\n${content}`;
  for (const phrase of PHRASES) {
    if (!plain.includes(phrase)) throw new Error(`본문 문구가 없습니다. ${phrase}`);
  }
  for (const snippet of FORBIDDEN) {
    if (plain.includes(snippet)) throw new Error(`빼야 할 내용이 남았습니다. ${snippet}`);
  }
  if (plain.includes('"horizontalRule"')) throw new Error("구분선이 생겼습니다.");
  const stats = documentStats(content);
  for (const key of ["images", "attachments", "tables", "codes"]) {
    if (stats[key] !== EXPECTED[key]) {
      throw new Error(`${key} 개수가 ${stats[key]}입니다. 기대값은 ${EXPECTED[key]}입니다.`);
    }
  }
  for (const href of HREFS) {
    if (!stats.hrefs.includes(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
  return stats;
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return { markdownToTiptapDoc, preparePageFindability, isMissingPageFindabilityColumn };
}

function toDoc(libs, markdown) {
  return JSON.stringify(libs.markdownToTiptapDoc(markdown));
}

function sqliteHasFindability(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) =>
    cols.includes(name)
  );
}

function loadLocalRows(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  return db
    .prepare(`SELECT ${fields.join(", ")} FROM custom_pages WHERE user_id = ?`)
    .all(LOCAL_USER);
}

function findRow(rows) {
  for (const row of rows ?? []) {
    if (isDuplicateRow(row, PAGE_TITLE, [SOURCE_URL])) return row;
  }
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

function importLocal(page, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  try {
    const existing = findRow(loadLocalRows(db));
    if (existing) {
      result.pageSkips += 1;
      result.pageId = existing.id;
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
      ).run(page.id, LOCAL_USER, page.title, page.content, page.created_at, page.updated_at);
    }
    result.pages += 1;
    return result;
  } finally {
    db.close();
  }
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
  if (bySource.error) {
    if (/source_url/i.test(bySource.error.message)) return null;
    throw bySource.error;
  }
  if (isDuplicateRow(bySource.data?.[0], PAGE_TITLE, [SOURCE_URL])) return bySource.data[0];
  return null;
}

async function importProduction(supabase, page, libs) {
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

async function persist(supabase, page, libs) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: page.title,
    content: page.content,
    sourceUrl: page.sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, libs);
  record.id = local.pageId;
  let production;
  try {
    production = await importProduction(supabase, record, libs);
  } catch (error) {
    if (local.pages === 1) {
      const db = new Database(resolve(root, "data/mymark.db"));
      try {
        db.prepare("DELETE FROM custom_pages WHERE id = ? AND user_id = ?").run(
          record.id,
          LOCAL_USER
        );
      } finally {
        db.close();
      }
    }
    throw error;
  }
  return {
    pageId: production.pageSkips ? production.pageId : local.pageId,
    localPages: local.pages,
    prodPages: production.pages,
    createdAt: now,
  };
}

function emit(payload) {
  const text = JSON.stringify(payload);
  if (text.includes("data:")) throw new Error("출력에 data URL이 있습니다.");
  console.log(text);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status} ${url}`);
  return response.text();
}

function hashOf(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function locate(supabase) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  try {
    const local = findRow(loadLocalRows(db));
    const prod = await findProductionPage(supabase);
    return { local, prod };
  } finally {
    db.close();
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const libs = loadLibs();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const found = await locate(supabase);
  if (found.local && found.prod) {
    emit({
      results: [
        {
          action: "skip",
          title: PAGE_TITLE,
          pageId: found.local.id,
          path: `/pages/${found.local.id}`,
          sourceUrl: SOURCE_URL,
          fetched: false,
        },
      ],
    });
    return;
  }
  if (found.local || found.prod) {
    throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${SOURCE_URL}`);
  }
  const markdown = articleMarkdownFromHtml(await fetchText(SOURCE_URL));
  const content = toDoc(libs, markdown);
  const stats = assertPage(markdown, content);
  if (checkOnly) {
    emit({
      results: [
        {
          action: "check",
          title: PAGE_TITLE,
          sourceUrl: SOURCE_URL,
          images: stats.images,
          attachments: stats.attachments,
          tables: stats.tables,
          codes: stats.codes,
          links: stats.links,
          length: content.length,
          hash: hashOf(content),
        },
      ],
    });
    return;
  }
  const saved = await persist(
    supabase,
    { title: PAGE_TITLE, content, sourceUrl: SOURCE_URL },
    libs
  );
  emit({
    results: [
      {
        action: saved.localPages + saved.prodPages > 0 ? "insert" : "skip",
        title: PAGE_TITLE,
        pageId: saved.pageId,
        path: `/pages/${saved.pageId}`,
        sourceUrl: SOURCE_URL,
        images: stats.images,
        attachments: stats.attachments,
        tables: stats.tables,
        codes: stats.codes,
        links: stats.links,
        hash: hashOf(content),
        length: content.length,
        createdAt: saved.createdAt,
        localPages: saved.localPages,
        prodPages: saved.prodPages,
      },
    ],
  });
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
