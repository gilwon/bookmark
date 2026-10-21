// every._ai court 스킬과 카운슬 프롬프트 글을 Pages에만 저장한다.
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_NAME = "every._ai";
const TRACKING_KEY = ["fb", "clid"].join("");

export const TOP_SKILLS_URL =
  "https://every-ai-guides.vercel.app/posts/claude-code-top-skills-5";
export const TOP_SKILLS_TITLE =
  "처음이라면 무조건 클로드 코드 최고의 스킬 5개 설치 가이드";
export const COURT_URL =
  "https://every-ai-guides.vercel.app/posts/claude-court-skill";
export const COURT_TITLE =
  "클로드가 구라 쳤는지 배심원 12명이 재판하는 court 스킬 설치·사용 가이드";
export const COUNCIL_URL =
  "https://every-ai-guides.vercel.app/posts/claude-council-prompt";
export const COUNCIL_TITLE =
  "맞장구만 치는 클로드를 쓴소리 회의로 바꾸는 카운슬 프롬프트";

export const COURT_EXPECTED = { images: 0, attachments: 0, tables: 0, codes: 9 };
export const COUNCIL_EXPECTED = { images: 0, attachments: 0, tables: 0, codes: 3 };
export const COURT_HREFS = [
  COURT_URL,
  "https://github.com/alexyc9381/court-skill",
  "https://instagram.com/nocodealex",
];
export const COUNCIL_HREFS = [
  COUNCIL_URL,
  "https://news.stanford.edu/stories/2026/03/ai-advice-sycophantic-models-research",
  "https://github.com/karpathy/llm-council",
];

const COURT_PHRASES = [
  "2026-10-20",
  "npx skills add alexyc9381/court-skill",
  "/court --quick",
  "VERDICT.md",
  "배심원 12명",
  "STEP 1 · 1분 court 스킬을 설치한다",
];
const COUNCIL_PHRASES = [
  "2026-10-20",
  "평균 49%",
  "사전 부검",
  "개인 의사결정 회의",
  "llm-council",
  "STEP 1 · 1분 카운슬 프롬프트를 붙여 넣는다",
];
const FORBIDDEN = [
  "수익화 노하우",
  "카톡방",
  "kakao",
  "from=guide",
  "from=dm",
  "from=guide-top",
  "youtube.com",
  "instagram.com/every",
  "claude-icon",
  TRACKING_KEY,
  "utm_source",
  "challenge-post-banner",
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

function isTrackingParam(key, value, host) {
  const social = host === "x.com" || host === "twitter.com";
  return (
    key.startsWith("utm_") ||
    key === TRACKING_KEY ||
    key === "gclid" ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1") ||
    (key === "from" &&
      ["dm", "guide", "littly", "column", "guide-top"].includes(value)) ||
    (key === "s" && social)
  );
}

/** localhost가 아니면 http를 https로 올리고, 추적 쿼리를 뺀다. */
export function stripTracking(url, base) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) {
    return url;
  }
  try {
    const parsed = new URL(url, base);
    const host = parsed.hostname.replace(/^www\./, "");
    for (const key of [...parsed.searchParams.keys()]) {
      const values = parsed.searchParams.getAll(key);
      if (values.some((value) => isTrackingParam(key, value, host))) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    if (parsed.protocol === "http:" && host !== "localhost" && host !== "127.0.0.1") {
      parsed.protocol = "https:";
    }
    return parsed.href;
  } catch {
    return String(url);
  }
}

/** 제목 또는 원문 주소가 같으면 이미 넣은 글이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (title && row.title === title) return true;
  return (markers ?? []).some((marker) => marker && row.source_url === marker);
}

function findRow(rows, title, markers) {
  for (const row of rows ?? []) {
    if (isDuplicateRow(row, title, markers)) return row;
  }
  return null;
}

function plainText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function pageTitleOf($) {
  const raw = $("article.post h1").first().text();
  return plainText(raw).replace(/\s*[—–-]\s*every\._ai\s*$/i, "");
}

function stripChrome(root) {
  root
    .find(
      "a.bootcamp-post-banner, .challenge-post-banner, a.challenge-post-banner, a.kakao-post-cta, section.challenge-banner, nav, footer, button, script, style, noscript, img, a[href*='youtube.com'], a[href*='instagram.com/every']"
    )
    .remove();
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

function rewriteLinks($, root, sourceUrl) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:") || href.startsWith("mailto:")) return;
    $(link).attr("href", stripTracking(href, sourceUrl));
  });
}

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
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

function cleanWebMarkdown(markdown, base) {
  return String(markdown ?? "")
    .replace(/\\([\[\]\.])/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTracking(path, base)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url, base))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** every._ai 글 HTML을 저장용 마크다운으로 바꾼다. */
export function articleMarkdownFromHtml(html, sourceUrl, expectedTitle) {
  const $ = cheerio.load(html);
  const article = $("article.post").first();
  if (!article.length) throw new Error("본문 영역 article.post 를 찾지 못했습니다.");
  const title = pageTitleOf($);
  if (title !== expectedTitle) throw new Error(`제목이 다릅니다. ${title}`);
  const content = article.clone();
  stripChrome(content);
  separateMetaSpans($, content);
  separateStepSpans($, content);
  content.find("h1").remove();
  rewriteLinks($, content, sourceUrl);
  const body = cleanWebMarkdown(
    createTurndown().turndown(content.html() || ""),
    sourceUrl
  );
  return [`# ${title}`, `> 원문. [${SITE_NAME}](${sourceUrl})`, body]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function visibleText(value) {
  return String(value ?? "");
}

function assertPage(markdown, content, spec) {
  const plain = visibleText(`${markdown}\n${content}`);
  for (const phrase of spec.phrases) {
    if (!plain.includes(phrase)) throw new Error(`본문 문구가 없습니다. ${phrase}`);
  }
  for (const snippet of spec.forbidden) {
    if (plain.includes(snippet)) throw new Error(`빼야 할 내용이 남았습니다. ${snippet}`);
  }
  if (plain.includes('"horizontalRule"')) throw new Error("구분선이 생겼습니다.");
  const stats = documentStats(content);
  for (const key of ["images", "attachments", "tables", "codes"]) {
    if (stats[key] !== spec.expected[key]) {
      throw new Error(`${key} 개수가 ${stats[key]}입니다. 기대값은 ${spec.expected[key]}입니다.`);
    }
  }
  for (const href of spec.hrefs) {
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

function importLocal(page, markers, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  try {
    const existing = findRow(loadLocalRows(db), page.title, markers);
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

async function findProductionPage(supabase, title, markers) {
  if (title) {
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .eq("title", title)
      .limit(1);
    if (error) throw error;
    if (isDuplicateRow(data?.[0], title, markers)) return data[0];
  }
  for (const marker of markers) {
    const bySource = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .eq("source_url", marker)
      .limit(1);
    if (bySource.error) {
      if (/source_url/i.test(bySource.error.message)) return null;
      throw bySource.error;
    }
    if (isDuplicateRow(bySource.data?.[0], title, markers)) return bySource.data[0];
  }
  return null;
}

async function importProduction(supabase, page, markers, libs) {
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page.title, markers);
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
  const markers = [page.sourceUrl];
  const local = importLocal(record, markers, libs);
  record.id = local.pageId;
  let production;
  try {
    production = await importProduction(supabase, record, markers, libs);
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

async function locate(supabase, title, sourceUrl) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  try {
    const local = findRow(loadLocalRows(db), title, [sourceUrl]);
    const prod = await findProductionPage(supabase, title, [sourceUrl]);
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
  const results = [];
  const known = await locate(supabase, TOP_SKILLS_TITLE, TOP_SKILLS_URL);
  if (!known.local || !known.prod) {
    throw new Error(`이미 있어야 하는 글이 한쪽에 없습니다. ${TOP_SKILLS_URL}`);
  }
  results.push({
    action: "skip",
    title: TOP_SKILLS_TITLE,
    pageId: known.local.id,
    path: `/pages/${known.local.id}`,
    sourceUrl: TOP_SKILLS_URL,
    fetched: false,
  });

  const targets = [
    {
      title: COURT_TITLE,
      sourceUrl: COURT_URL,
      expected: COURT_EXPECTED,
      hrefs: COURT_HREFS,
      phrases: COURT_PHRASES,
      forbidden: FORBIDDEN,
    },
    {
      title: COUNCIL_TITLE,
      sourceUrl: COUNCIL_URL,
      expected: COUNCIL_EXPECTED,
      hrefs: COUNCIL_HREFS,
      phrases: COUNCIL_PHRASES,
      forbidden: FORBIDDEN,
    },
  ];
  for (const target of targets) {
    const found = await locate(supabase, target.title, target.sourceUrl);
    if (found.local && found.prod) {
      results.push({
        action: "skip",
        title: target.title,
        pageId: found.local.id,
        path: `/pages/${found.local.id}`,
        sourceUrl: target.sourceUrl,
        fetched: false,
      });
      continue;
    }
    if (found.local || found.prod) {
      throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${target.sourceUrl}`);
    }
    const html = await fetchText(target.sourceUrl);
    const markdown = articleMarkdownFromHtml(html, target.sourceUrl, target.title);
    const content = toDoc(libs, markdown);
    const stats = assertPage(markdown, content, target);
    if (checkOnly) {
      results.push({
        action: "check",
        title: target.title,
        sourceUrl: target.sourceUrl,
        images: stats.images,
        attachments: stats.attachments,
        tables: stats.tables,
        codes: stats.codes,
        links: stats.links,
        length: content.length,
        hash: hashOf(content),
      });
      continue;
    }
    const saved = await persist(
      supabase,
      { title: target.title, content, sourceUrl: target.sourceUrl },
      libs
    );
    results.push({
      action: saved.localPages + saved.prodPages > 0 ? "insert" : "skip",
      title: target.title,
      pageId: saved.pageId,
      path: `/pages/${saved.pageId}`,
      sourceUrl: target.sourceUrl,
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
    });
  }
  emit({ results });
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
