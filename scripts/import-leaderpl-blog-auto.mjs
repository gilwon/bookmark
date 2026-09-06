// 리더플AI 클로드 블로그 자동화 설계도를 Pages에만 저장한다
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
  isZipBytes,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

export const SOURCE_URL = "https://leaderpl-blog-auto.netlify.app/";
export const PAGE_TITLE = "매일 쓰는 블로그 글, 명령 두 줄로 끝내는 구조";
export const OG_IMAGE_URL = "https://leaderpl-blog-auto.netlify.app/og-image.png";
export const OG_IMAGE_BYTES = 44162;
export const EXPECTED_IMAGES = 1;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 2;
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
const REQUIRED_PHRASES = [
  SOURCE_URL,
  "/post",
  "Playwright",
  "CLAUDE.md",
  "node -v",
  "자동화는 임시저장에서 멈춥니다",
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

/** 제목 또는 원문 식별자가 있으면 중복이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const hay = `${row.source_url ?? ""}\n${row.content ?? ""}`;
  return markers.some((marker) => marker && hay.includes(marker));
}

/** SVG를 포함해 이미지 MIME을 판별한다. */
export function mediaMime(bytes, header) {
  const head = Buffer.from(bytes.subarray(0, 200)).toString("utf8");
  if (head.includes("<svg") || head.includes("<?xml")) {
    return "image/svg+xml";
  }
  try {
    return imageMime(bytes, header);
  } catch {
    if (header?.startsWith("image/")) return header.split(";")[0];
    throw new Error("이미지 MIME을 판별하지 못했습니다.");
  }
}

function unescapeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapePreBody(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** pre 안의 태그 모양 문구가 HTML 파서에 깨지지 않게 이스케이프한다. */
export function protectPreBlocks(html) {
  return String(html ?? "").replace(
    /<pre(\b[^>]*)>([\s\S]*?)<\/pre>/gi,
    (_match, attrs, body) =>
      `<pre${attrs}>${escapePreBody(unescapeHtml(body))}</pre>`
  );
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
    .replace(/^\s*복사(?:됨!)?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function blockText($, node) {
  const clone = node.clone();
  clone.find("br").replaceWith("\n");
  return clone
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .trim();
}

function fenceSpecialBlocks($, root) {
  root.find("div.term").each((_, el) => {
    const text = blockText($, $(el));
    $(el).replaceWith($("<pre>").text(text));
  });
  root.find("div.say-b").each((_, el) => {
    const text = blockText($, $(el));
    $(el).replaceWith($("<pre>").text(text));
  });
  root.find("div.callout").each((_, el) => {
    const node = $(el);
    const heading = node.find(".t").first().text().replace(/\s+/g, " ").trim();
    const body = node
      .clone()
      .find(".t")
      .remove()
      .end()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const lines = [":::callout"];
    if (heading) lines.push(`**${heading}**`);
    if (body) lines.push(body);
    lines.push(":::");
    node.replaceWith($("<p>").text(lines.join("\n")));
  });
}

function rewriteLinks($, root, sourceUrl) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:")) return;
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
}

function fencePrePlaceholders($, root) {
  const fences = [];
  root.find("pre").each((_, el) => {
    const body = $(el)
      .text()
      .replace(/^\n+/, "")
      .replace(/\n+$/, "");
    const token = `@@PRE${fences.length}@@`;
    fences.push(body);
    $(el).replaceWith($("<p>").text(token));
  });
  return fences;
}

function restorePreFences(markdown, fences) {
  let out = String(markdown ?? "");
  fences.forEach((body, index) => {
    const token = `@@PRE${index}@@`;
    const fence = `\`\`\`\n${body}\n\`\`\``;
    if (!out.includes(token)) {
      throw new Error(`코드 자리 표시를 찾지 못했습니다. ${token}`);
    }
    out = out.replace(token, fence);
  });
  return out;
}

function restoreCalloutFences(markdown) {
  return String(markdown ?? "").replace(
    /:::callout\n([\s\S]*?)\n:::/g,
    (_match, inner) => `\n\n:::callout\n${inner.trim()}\n:::\n\n`
  );
}

function pageTitleOf($) {
  const h1 = $("main h1").first();
  if (h1.length) {
    const clone = h1.clone();
    clone.find("br").replaceWith(" ");
    return clone
      .text()
      .replace(/\s+/g, " ")
      .trim();
  }
  const fromDoc = ($("title").first().text() || "")
    .replace(/\s*\|\s*리더플AI.*$/, "")
    .trim();
  return fromDoc;
}

function selectContent($) {
  const main = $("main").first();
  if (!main.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const footer = $("footer").first();
  const root = $("<div>");
  root.append(main.clone());
  if (footer.length) root.append(footer.clone());
  root.find("script, style, noscript").remove();
  root.find("link[rel='icon'], link[rel='shortcut icon']").remove();
  return root;
}

/** 가이드 HTML을 저장용 마크다운으로 바꾼다. */
export function parseLeaderplHtml(html, sourceUrl = SOURCE_URL, cover = "") {
  const canonical = stripTracking(sourceUrl);
  const $ = cheerio.load(protectPreBlocks(html));
  const root = selectContent($);
  const title = pageTitleOf($) || PAGE_TITLE;
  root.find("h1").first().remove();
  fenceSpecialBlocks($, root);
  rewriteLinks($, root, canonical);
  const fences = fencePrePlaceholders($, root);
  const articleMarkdown = restoreCalloutFences(
    restorePreFences(
      createTurndown().turndown(root.html() || "").trim(),
      fences
    )
  );
  const cleaned = cleanWebMarkdown(articleMarkdown, canonical);
  const markdown = [
    `# ${title}`,
    `> 원문. [리더플AI](${canonical})`,
    cover,
    cleaned,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (markdown.includes("netlify.new")) {
    throw new Error("Netlify 유입 링크가 본문에 남아 있습니다.");
  }
  if (markdown.includes("favicon.svg")) {
    throw new Error("파비콘이 본문에 남아 있습니다.");
  }
  return { title, markdown };
}

async function dataUrlFromResponse(response) {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dataUrl = `data:${mediaMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  if (!dataUrl.startsWith("data:image")) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  return { dataUrl, bytes: bytes.length };
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
      if (response.ok) return dataUrlFromResponse(response);
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
    if (String(imageUrl).includes("favicon")) {
      $(image).remove();
      continue;
    }
    if (imageUrl.startsWith("data:")) {
      if (!imageUrl.startsWith("data:image")) {
        throw new Error("이미지가 data URL이 아닙니다.");
      }
      $(image).attr("src", imageUrl);
      continue;
    }
    imageUrl = new URL(imageUrl, sourceUrl).href;
    const { dataUrl } = await downloadImage(imageUrl, sourceUrl);
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
  }
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
  if (!href || href.startsWith("data:") || href.startsWith("mailto:") || href.startsWith("#")) {
    return false;
  }
  try {
    return FILE_HREF_RE.test(new URL(href).pathname);
  } catch {
    return FILE_HREF_RE.test(href);
  }
}

async function inlineAttachments($, content, sourceUrl) {
  const links = [...content.find("a[href]").toArray()];
  for (const link of links) {
    const href = $(link).attr("href") || "";
    if (!href || href.startsWith("data:")) continue;
    const abs = toAbsoluteUrl(href, sourceUrl);
    if (!isFileHref(abs)) continue;
    const filename =
      filenameFromUrl(abs) ||
      $(link).text().replace(/\s+/g, " ").trim() ||
      "첨부 파일";
    if (/\.zip$/i.test(filename) || /\.zip(?:$|[?#])/i.test(abs)) {
      throw new Error(
        "ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다."
      );
    }
    const response = await fetch(abs, {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: sourceUrl,
      },
    });
    if (!response.ok) throw new Error(`첨부 HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (isZipBytes(bytes, filename)) {
      throw new Error(
        "ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다."
      );
    }
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

function assertIntegrity({ title, markdown, stats, content }) {
  if (title !== PAGE_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${title}`);
  }
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [리더플AI](${SOURCE_URL})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== EXPECTED_TABLES) {
    throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== EXPECTED_IMAGES) {
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
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (markdown.includes("favicon") || content.includes("favicon.svg")) {
    throw new Error("파비콘이 저장 본문에 남아 있습니다.");
  }
  if (markdown.includes("netlify.new") || markdown.includes("utm_campaign")) {
    throw new Error("추적 쿼리가 저장 본문에 남아 있습니다.");
  }
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
    .prepare(
      `SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ?`
    )
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
  for (const marker of markers) {
    if (!marker) continue;
    const row = db
      .prepare(
        `SELECT ${select} FROM custom_pages
         WHERE user_id = ? AND content LIKE ?
         LIMIT 1`
      )
      .get(LOCAL_USER, `%${marker}%`);
    if (isDuplicateRow(row, title, markers)) return row;
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
  const existing = await findProductionPage(
    supabase,
    page.title,
    page.sourceUrl
  );
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

async function persist(title, content, extra, libs) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title,
    content,
    sourceUrl: SOURCE_URL,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markersOf(), libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  const pageId = production.pageId || local.pageId;
  return {
    ...extra,
    pageId,
    path: `/pages/${pageId}`,
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

async function buildImportedPage() {
  const html = await fetchText(SOURCE_URL);
  const $ = cheerio.load(html);
  const main = $("main").first();
  if (!main.length) throw new Error("본문 영역을 찾지 못했습니다.");
  if (main.find("img").length !== 0) {
    throw new Error(`본문 이미지가 0이어야 합니다. ${main.find("img").length}`);
  }
  await inlineBodyImages($, main, SOURCE_URL);
  await inlineAttachments($, main, SOURCE_URL);
  const cover = await downloadImage(OG_IMAGE_URL, SOURCE_URL);
  if (cover.bytes !== OG_IMAGE_BYTES) {
    throw new Error(`OG 이미지 크기가 다릅니다. ${cover.bytes}`);
  }
  return parseLeaderplHtml(
    $.html(),
    SOURCE_URL,
    `![표지](${cover.dataUrl})`
  );
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const parsed = await buildImportedPage();
  const libs = loadLibs();
  const content = JSON.stringify(libs.markdownToTiptapDoc(parsed.markdown));
  const stats = documentStats(content);
  assertIntegrity({
    title: parsed.title,
    markdown: parsed.markdown,
    stats,
    content,
  });
  const extra = {
    pageTitle: parsed.title,
    images: stats.images,
    attachments: stats.attachments,
    codes: stats.codes,
    tables: stats.tables,
  };
  if (checkOnly) {
    console.log(JSON.stringify(extra, null, 2));
    return;
  }
  const result = await persist(parsed.title, content, extra, libs);
  console.log(JSON.stringify(result, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
