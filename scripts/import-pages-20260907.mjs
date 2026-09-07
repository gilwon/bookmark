// 영선 오픈소스 TOP 3와 짐코딩 스킬 실전 가이드를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import {
  assertDownloadableAttachment,
  documentStats,
  imageMime,
} from "./import-claude-eli5-page.mjs";
import {
  buildImportedPage,
  extractGymAccordions,
  fillFaqAnswers,
} from "./import-gymcoding-articles.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const FILE_HREF_RE = /\.(pdf|zip|docx?|xlsx?|pptx?|csv|txt)(?:$|[?#])/i;
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
];
const YEONGSEON_FORBIDDEN = [
  "fbclid",
  "D-DAY",
  "open.kakao.com",
  "이어서 볼 것",
  "이메일로 받아",
];
const GYMCODING_FORBIDDEN = [
  "fbclid",
  "동의하고 구독",
  "짐코딩 뉴스레터",
  "인프런",
  "/logo.svg",
  "inf.run",
  "opengraph-image",
];

export const YEONGSEON_URL =
  "https://yeongseon.kr/archive/3b1d86104de280808016e91f0ba5cd4d.html";
export const YEONGSEON_TITLE = "직장인들을 위한 무료 오픈소스 TOP 3";
export const YEONGSEON_IMAGE_BYTES = 95296;
export const YEONGSEON_IMAGE_URL =
  "https://yeongseon.kr/archive/img/3b1d86104de28010bc49d45f471e9941.png";
export const GOOGLE_DOCS_URL =
  "https://docs.google.com/document/d/10xN11yOKswKJUKwjwF7AICN6bQwz4ToGq5QIhF3BFx0/preview?usp=sharing";
export const GYMCODING_URL =
  "https://www.gymcoding.co/articles/claude-code-skills-5-practical-guide";
export const GYMCODING_TITLE =
  "클로드 코드 스킬 추천 5개: 설치 방법·실전 프롬프트·코드 예시";
export const GITHUB_URLS = [
  "https://github.com/iOfficeAI/OfficeCLI",
  "https://github.com/jgm/pandoc",
  "https://github.com/microsoft/markitdown",
];

export const TARGETS = [
  {
    key: "yeongseon",
    kind: "yeongseon",
    title: YEONGSEON_TITLE,
    sourceUrl: YEONGSEON_URL,
    images: 1,
    attachments: 0,
  },
  {
    key: "gymcoding",
    kind: "gymcoding",
    title: GYMCODING_TITLE,
    sourceUrl: GYMCODING_URL,
    minImages: 1,
    attachments: 0,
    minCodes: 5,
    minTables: 1,
  },
];

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

const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === "fbclid" ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1")
  );
}

/** 유입 추적 쿼리를 빼고 절대 주소로 바꾼다. */
export function stripTracking(url, base) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) {
    return url;
  }
  try {
    const parsed = new URL(url, base);
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (isTrackingParam(key, value)) parsed.searchParams.delete(key);
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return String(url)
      .replace(/[?&](?:utm_[^=&#]*|fbclid|pvs|igsh|mcp_token)=[^&\s)#]*/g, "")
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]m=1(?=[&#]|$)/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** 만료 URL 문자열이 본문에 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

/** 원문 URL이 같으면 중복이다. 제목만 같아도 중복이 아니다. */
export function isDuplicateRow(row, _title, markers) {
  if (!row) return false;
  const hay = `${row.source_url ?? ""}\n${row.content ?? ""}`;
  return markers.some(
    (marker) => marker && (row.source_url === marker || hay.includes(marker))
  );
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const { extractPageMediaReferences } = require(
    resolve(root, "src/lib/page-attachment-storage.ts")
  );
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return {
    markdownToTiptapDoc,
    extractPageMediaReferences,
    preparePageFindability,
    isMissingPageFindabilityColumn,
  };
}

function toAbsoluteUrl(url, base) {
  if (!url || url.startsWith("data:") || url.startsWith("mailto:")) return url;
  return stripTracking(url, base);
}

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
}

function imageSourcesOf(tiptapJsonString) {
  const sources = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") sources.push(String(node.attrs?.src ?? ""));
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return sources;
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
      const text = String(node.textContent || "")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "");
      return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    },
  });
  turndown.addRule("tables", {
    filter: "table",
    replacement(_content, table) {
      const html = table.outerHTML || "";
      const $table = cheerio.load(html || "<table></table>");
      const rows = [];
      $table("tr").each((_, tr) => {
        const cells = [];
        $table(tr)
          .find("th, td")
          .each((__, cell) => {
            cells.push(
              $table(cell)
                .text()
                .replace(/\s+/g, " ")
                .replace(/\|/g, "\\|")
                .trim()
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

function rewriteMarkdownHrefs(markdown) {
  return String(markdown)
    .replace(
      /\]\((https?:\/\/[^)\s]+)\)/g,
      (_match, url) => `](${stripTracking(url)})`
    )
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url));
}

function selectYeongseonArticle($) {
  const article = $("article.wrap").first();
  if (!article.length) throw new Error("본문 영역을 찾지 못했습니다.");
  return article;
}

function cleanYeongseonArticle($, article) {
  article.find("aside.promo a.bm").each((_, el) => {
    $(el).insertBefore($(el).closest("aside.promo"));
  });
  article.find("ul.chips, nav.rel, .cta, aside.promo").remove();
  article.find("aside.note").each((_, el) => {
    const node = $(el);
    if (!node.text().includes("D-DAY")) return;
    let next = node.next();
    node.remove();
    while (next.length) {
      const current = next;
      next = current.next();
      current.remove();
    }
  });
  article.find("script, style, noscript").remove();
  article.find("figure.doc a").each((_, link) => {
    const node = $(link);
    const img = node.find("img").first();
    if (img.length) node.replaceWith(img);
  });
}

function rewriteMedia($, content, sourceUrl) {
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:")) return;
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
  content.find("img").each((_, image) => {
    const src = imageSrcOf(image, $);
    if (!src || src.startsWith("data:")) return;
    $(image).attr("src", toAbsoluteUrl(src, sourceUrl));
  });
}

function toYeongseonMarkdown($, article) {
  const h1 = article.find("h1").first();
  const title = h1.text().replace(/\s+/g, " ").trim() || YEONGSEON_TITLE;
  h1.remove();
  const articleMarkdown = cleanWebMarkdown(
    createTurndown().turndown(article.html() || "").trim(),
    YEONGSEON_URL
  );
  const markdown = rewriteMarkdownHrefs(
    [`# ${title}`, `> 원문. [신영선 자료](${YEONGSEON_URL})`, articleMarkdown]
      .filter(Boolean)
      .join("\n\n")
      .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
  return { title, markdown };
}

/** 영선 아카이브 HTML을 저장용 마크다운으로 바꾼다. */
export function parseYeongseonHtml(html, sourceUrl = YEONGSEON_URL) {
  const $ = cheerio.load(html);
  const article = selectYeongseonArticle($);
  cleanYeongseonArticle($, article);
  rewriteMedia($, article, sourceUrl);
  return toYeongseonMarkdown($, article);
}

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean).at(-1) || ""
    );
    return name || "";
  } catch {
    return "";
  }
}

function isFileHref(href) {
  if (
    !href ||
    href.startsWith("data:") ||
    href.startsWith("mailto:") ||
    href.startsWith("#")
  ) {
    return false;
  }
  try {
    return FILE_HREF_RE.test(new URL(href).pathname);
  } catch {
    return FILE_HREF_RE.test(href);
  }
}

function mediaMime(bytes, header) {
  try {
    return imageMime(bytes, header);
  } catch {
    if (header?.startsWith("image/")) return header.split(";")[0];
    throw new Error("이미지 MIME을 판별하지 못했습니다.");
  }
}

async function dataUrlFromResponse(response, sourceUrl) {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const finalUrl = stripTracking(response.url || sourceUrl, sourceUrl);
  if (
    String(finalUrl).includes("3b1d86104de28010bc49d45f471e9941.png") &&
    bytes.length !== YEONGSEON_IMAGE_BYTES
  ) {
    throw new Error(`영선 이미지 크기가 다릅니다. ${bytes.length}`);
  }
  const dataUrl = `data:${mediaMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  if (!dataUrl.startsWith("data:image")) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  return dataUrl;
}

async function downloadImage(url, referer) {
  let lastError = new Error(`이미지를 받지 못했습니다. ${url}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0",
          referer: referer || url,
        },
      });
      if (response.ok) return dataUrlFromResponse(response, url);
      lastError = new Error(`이미지 HTTP ${response.status}: ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await pause(400 * (attempt + 1));
  }
  throw lastError;
}

async function inlineBodyImages($, content, sourceUrl) {
  const images = [...content.find("img").toArray()];
  for (const image of images) {
    let imageUrl = imageSrcOf(image, $);
    if (!imageUrl) throw new Error("이미지 URL이 없습니다.");
    if (imageUrl.startsWith("data:")) {
      if (!imageUrl.startsWith("data:image")) {
        throw new Error("이미지가 data URL이 아닙니다.");
      }
      if (!hasNoExpiredUrl(imageUrl)) {
        throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
      }
      $(image).attr("src", imageUrl);
      $(image).removeAttr("srcset");
      $(image).removeAttr("data-src");
      $(image).removeAttr("data-lazy-src");
      continue;
    }
    imageUrl = toAbsoluteUrl(imageUrl, sourceUrl);
    const dataUrl = await downloadImage(imageUrl, sourceUrl);
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
    $(image).removeAttr("data-src");
    $(image).removeAttr("data-lazy-src");
  }
}

async function inlineAttachments($, content, sourceUrl) {
  const links = [...content.find("a[href]").toArray()];
  for (const link of links) {
    const href = $(link).attr("href") || "";
    if (!href || href.startsWith("data:")) continue;
    const abs = toAbsoluteUrl(href, sourceUrl);
    const filename =
      filenameFromUrl(abs) ||
      $(link).text().replace(/\s+/g, " ").trim() ||
      "첨부 파일";
    if (/\.zip$/i.test(filename) || /\.zip(?:$|[?#])/i.test(abs)) {
      throw new Error(
        "ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다."
      );
    }
    if (!isFileHref(abs)) continue;
    const response = await fetch(abs, {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: sourceUrl,
      },
    });
    if (!response.ok) throw new Error(`첨부 HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const markdown = assertDownloadableAttachment(
      filename,
      bytes,
      response.headers.get("content-type")
    );
    const dataUrl = markdown.slice(
      markdown.indexOf("(") + 1,
      markdown.lastIndexOf(")")
    );
    $(link).attr("href", dataUrl);
    if (!$(link).text().trim()) $(link).text(filename);
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      referer: url,
    },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

function assertContains(text, phrase, label) {
  if (!String(text ?? "").includes(phrase)) {
    throw new Error(`${label}이 없습니다. ${phrase}`);
  }
}

function assertYeongseonRecord(markdown, content, stats) {
  if (!markdown.startsWith(`# ${YEONGSEON_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [신영선 자료](${YEONGSEON_URL})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  assertContains(markdown, "하루를 잡아먹는 건 회의가 아닙니다", "본문 문구");
  assertContains(markdown, "10배 더 빠르게 흡수하는 방법", "본문 문구");
  for (const url of GITHUB_URLS) {
    assertContains(markdown, url, "GitHub 링크");
  }
  if (!markdown.includes(GOOGLE_DOCS_URL) && !content.includes(GOOGLE_DOCS_URL)) {
    throw new Error("Google Docs 주소가 없습니다.");
  }
  if (stats.images !== 1) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== 0) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== 1) {
    throw new Error(`본문 이미지 수가 다릅니다. ${sources.length}`);
  }
  for (const src of sources) {
    if (!src.startsWith("data:image")) {
      throw new Error("이미지가 data URL이 아닙니다.");
    }
    if (!hasNoExpiredUrl(src)) {
      throw new Error("이미지에 만료 URL이 남아 있습니다.");
    }
  }
  for (const forbidden of YEONGSEON_FORBIDDEN) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
}

function countFaqHeadings(markdown) {
  return [...String(markdown ?? "").matchAll(/^### .+\?$/gm)].length;
}

function assertGymcodingRecord(built, stats) {
  if (built.title !== GYMCODING_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${built.title}`);
  }
  if (built.sourceUrl !== GYMCODING_URL) {
    throw new Error(`원문 주소가 다릅니다. ${built.sourceUrl}`);
  }
  if (!built.markdown.includes(GYMCODING_URL) && !built.content.includes(GYMCODING_URL)) {
    throw new Error("원문 주소가 본문에 없습니다.");
  }
  if (stats.images < 1) {
    throw new Error(`본문 이미지가 부족합니다. ${stats.images}`);
  }
  if (stats.attachments !== 0) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.codes < 5) {
    throw new Error(`코드 블록이 부족합니다. ${stats.codes}`);
  }
  if (stats.tables < 1) {
    throw new Error(`표가 부족합니다. ${stats.tables}`);
  }
  const sources = imageSourcesOf(built.content);
  if (sources.length < 1) {
    throw new Error(`본문 이미지가 부족합니다. ${sources.length}`);
  }
  for (const src of sources) {
    if (!src.startsWith("data:image")) {
      throw new Error("이미지가 data URL이 아닙니다.");
    }
  }
  if (countFaqHeadings(built.markdown) < 6) {
    throw new Error("FAQ 질문이 6개가 아닙니다.");
  }
  assertContains(built.markdown, "SKILL.md", "FAQ 답");
  assertContains(
    built.markdown,
    "아닙니다. 지금 해결할 문제에 맞는 스킬만",
    "FAQ 답"
  );
  for (const forbidden of GYMCODING_FORBIDDEN) {
    if (built.markdown.includes(forbidden) || built.content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  if (!hasNoExpiredUrl(built.markdown) || !hasNoExpiredUrl(built.content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  void extractGymAccordions;
  void fillFaqAnswers;
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

function findLocalPage(db, sourceUrl) {
  const cols = pageColumns(db);
  const fields = ["id", "title", "content"];
  if (cols.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const markers = [sourceUrl];
  if (cols.includes("source_url")) {
    const row = db
      .prepare(
        `SELECT ${select} FROM custom_pages
         WHERE user_id = ? AND source_url = ?
         LIMIT 1`
      )
      .get(LOCAL_USER, sourceUrl);
    if (isDuplicateRow(row, "", markers)) return row;
  }
  const byContent = db
    .prepare(
      `SELECT ${select} FROM custom_pages
       WHERE user_id = ? AND content LIKE ?
       LIMIT 1`
    )
    .get(LOCAL_USER, `%${sourceUrl}%`);
  if (isDuplicateRow(byContent, "", markers)) return byContent;
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

function importLocal(page, sourceUrl, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, sourceUrl);
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

async function findProductionPage(supabase, sourceUrl) {
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
  const existing = await findProductionPage(supabase, page.sourceUrl);
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

async function persist(title, content, extra, libs, sourceUrl) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title,
    content,
    sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, sourceUrl, libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  return {
    ...extra,
    pageId: production.pageId || local.pageId,
    path: `/pages/${production.pageId || local.pageId}`,
    local: {
      pages: local.pages,
      pageSkips: local.pageSkips,
    },
    production: {
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  };
}

async function importYeongseon(spec, checkOnly, libs) {
  const sourceUrl = stripTracking(spec.sourceUrl);
  const html = await fetchText(sourceUrl);
  const $ = cheerio.load(html);
  const article = selectYeongseonArticle($);
  cleanYeongseonArticle($, article);
  rewriteMedia($, article, sourceUrl);
  await inlineBodyImages($, article, sourceUrl);
  await inlineAttachments($, article, sourceUrl);
  const parsed = toYeongseonMarkdown($, article);
  if (parsed.title !== YEONGSEON_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${parsed.title}`);
  }
  const content = JSON.stringify(libs.markdownToTiptapDoc(parsed.markdown));
  const stats = documentStats(content);
  assertYeongseonRecord(parsed.markdown, content, stats);
  const extra = {
    key: spec.key,
    pageTitle: parsed.title,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    codes: stats.codes,
  };
  if (checkOnly) return extra;
  return persist(parsed.title, content, extra, libs, sourceUrl);
}

async function importGymcoding(spec, checkOnly, libs) {
  const built = await buildImportedPage(spec.sourceUrl, libs);
  const stats = documentStats(built.content);
  assertGymcodingRecord(built, stats);
  const extra = {
    key: spec.key,
    pageTitle: built.title,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    codes: stats.codes,
  };
  if (checkOnly) return extra;
  return persist(built.title, built.content, extra, libs, built.sourceUrl);
}

async function importTarget(spec, checkOnly, libs) {
  if (spec.kind === "gymcoding") {
    return importGymcoding(spec, checkOnly, libs);
  }
  return importYeongseon(spec, checkOnly, libs);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const results = [];
  for (const target of TARGETS) {
    results.push(await importTarget(target, checkOnly, libs));
  }
  if (checkOnly) {
    console.log(JSON.stringify({ results }, null, 2));
    return;
  }
  const summary = {
    local: { pages: 0, pageSkips: 0 },
    production: { pages: 0, pageSkips: 0 },
    results,
  };
  for (const item of results) {
    summary.local.pages += item.local?.pages ?? 0;
    summary.local.pageSkips += item.local?.pageSkips ?? 0;
    summary.production.pages += item.production?.pages ?? 0;
    summary.production.pageSkips += item.production?.pageSkips ?? 0;
  }
  console.log(JSON.stringify(summary, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
