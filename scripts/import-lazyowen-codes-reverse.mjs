// 게으른 빌더 챗GPT 코드 100개와 심팀장 REA 글을 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { assertDownloadableAttachment, documentStats } from "./import-claude-eli5-page.mjs";
import { imageDataUrl } from "./import-every-ai-index-20261013.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const TRACKING_KEY = ["fb", "clid"].join("");

export const CODES_URL = "https://lazyowen.com/guides/chatgpt-prompt-codes-100";
export const CODES_TITLE = "챗GPT 쓸 때 모르면 손해인 코드 100개";
export const REVERSE_URL = "https://shimteamjjang.vercel.app/reverse";
export const REVERSE_TITLE = "앱을 AI가 뜯어서 다시 만들어 주는 무료 도구";
export const REVERSE_IMAGE_ALT = "심팀장님 캐릭터";

const CODES_ORIGIN = "https://lazyowen.com";
const REVERSE_ORIGIN = "https://shimteamjjang.vercel.app";
const PDF_NAME = "chatgpt-prompt-codes-100.pdf";
const PDF_BYTES = 289275;
const PDF_SHA256 = "7aba87d0c502fcb3c6db598cc014b6015c09b22dd2abf7a6ddea373adc64747d";
const PNG_BYTES = 157715;
const PNG_SHA256 = "16783911aa2134a0d6ba1f02c74eb261fd7bc536fb5eb9bd6b23feae139ddef2";

export const CODES_EXPECTED = { images: 0, attachments: 2, tables: 0, codes: 16 };
export const REVERSE_EXPECTED = { images: 1, attachments: 0, tables: 1, codes: 6 };

const CODES_HREFS = [
  CODES_URL,
  "https://chatgpt.com/",
  "https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq",
  "https://help.openai.com/en/collections/3742473-chatgpt",
  "https://www.instagram.com/lazy_owen/",
];
const REVERSE_HREFS = [
  REVERSE_URL,
  "https://github.com/morluto/rea",
  "https://rea.tools/",
  "https://rea.tools/showcase/notion/",
];
const CODES_PHRASES = [
  "2026-10-09 공개",
  "STEP 1. 코드 붙이는 공식 익히기",
  "STEP 5. 두 개 섞고 맥락 붙이기",
  "코드 100개 전체 목록",
  "100. NEXTSTEP",
  "PDF 내려받기",
  "<답에서 바꾸고 싶은 점 한 가지",
];
const REVERSE_PHRASES = [
  "설치 3단계 · 복붙 사용 문장 · 노션 사례 · 꼭 알아둘 것",
  "꼭 알아둘 것",
  "무엇을 뜯나",
  "npx rea-agents setup",
  "이 앱, 이 기능 어떻게 돌아가는지 보고 똑같이 만들어줘",
  "메모 앱에서 검색이 어떻게 동작하는지 파악하고, 근거를 보여준 다음, 내 프로젝트에 비슷한 기능을 만들어줘",
  "REA를 써서 노션이 글과 HTML을 시스템 클립보드로 어떻게 복사하는지 따라가 줘. 단계마다 코드를 보여줘",
  "npx -y rea-agents@latest analyze-javascript-application /앱/폴더/전체/경로 --json",
  "npx rea-agents@latest setup",
  "참고: REA 저장소 README",
  "2026-10-13",
  REVERSE_IMAGE_ALT,
];
const FORBIDDEN = [
  TRACKING_KEY,
  "utm_source",
  "gclid",
  "youtube.com",
  "30일 AI 챌린지",
  "이메일 하나면",
  "300만원",
  "og-reverse.png",
  "/challenge",
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
];

const envPath = resolve(root, [".", "env", ".local"].join(""));
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

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === TRACKING_KEY ||
    key === "gclid" ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1") ||
    (key === "from" && (value === "dm" || value === "guide" || value === "littly"))
  );
}

/** localhost와 127.0.0.1이 아니면 http를 https로 올린다. */
function upgradeHttp(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (parsed.protocol === "http:" && host !== "localhost" && host !== "127.0.0.1") {
      parsed.protocol = "https:";
    }
    return parsed.href;
  } catch {
    return url;
  }
}

/** 추적 쿼리를 빼고 절대 주소로 바꾼다. data URL은 그대로 둔다. */
export function stripTracking(url, base) {
  const value = String(url ?? "");
  if (!value || value.startsWith("data:") || value.startsWith("mailto:")) return value;
  try {
    const parsed = new URL(value, base);
    for (const key of [...parsed.searchParams.keys()]) {
      const values = parsed.searchParams.getAll(key);
      if (values.some((item) => isTrackingParam(key, item))) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return upgradeHttp(parsed.href);
  } catch {
    const tracking = ["utm_[^=&#]*", TRACKING_KEY, "gclid", "pvs", "igsh", "mcp_token"].join("|");
    return upgradeHttp(
      value
        .replace(new RegExp(`[?&](?:${tracking})=[^&\\s)#]*`, "g"), "")
        .replace(/[?&]source=copy_link(?=[&#]|$)/g, "")
        .replace(/[?&]m=1(?=[&#]|$)/g, "")
        .replace(/[?&]from=(?:dm|guide|littly)(?=[&#]|$)/g, "")
        .replace(/\?&/g, "?")
        .replace(/[?&]$/, "")
    );
  }
}

/** 제목 또는 원문 주소가 정확히 같으면 중복이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (title && row.title === title) return true;
  return (markers ?? []).some((marker) => marker && row.source_url === marker);
}

function sha256(bytes) {
  const hash = createHash("sha256");
  hash.write(bytes);
  hash.end();
  return hash.digest("hex");
}

function loadLibs() {
  const require = createRequire(resolve(root, "package.json"));
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return { markdownToTiptapDoc, preparePageFindability, isMissingPageFindabilityColumn };
}

function cellMarkdown(html) {
  const mini = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  return mini
    .turndown(String(html ?? ""))
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
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
            cells.push(cellMarkdown($table(cell).html() || ""));
          });
        if (cells.some(Boolean)) rows.push(cells);
      });
      if (!rows.length) return "";
      const width = Math.max(...rows.map((row) => row.length));
      const padded = rows.map((row) => {
        const next = row.slice();
        while (next.length < width) next.push("");
        return next;
      });
      const divider = padded[0].map(() => "---");
      return `\n\n${[padded[0], divider, ...padded.slice(1)]
        .map((row) => `| ${row.join(" | ")} |`)
        .join("\n")}\n\n`;
    },
  });
  return turndown;
}

function dropCopyBars($, content) {
  content.find("button").each((_, button) => {
    const bar = $(button).parent();
    if (bar.find("pre, table").length === 0) bar.remove();
    else $(button).remove();
  });
}

/** 펜스 안 글자는 그대로 두고, 밖에서는 이스케이프만 푼다. */
function finishMarkdown(markdown) {
  const lines = String(markdown ?? "").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^(```+|~~~+)/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const restored = line.replace(/\\_/g, "_").replace(/\\\./g, ".");
      if (/^\u200B/.test(restored)) return restored;
      if (/^\d{4}\.\s+\d{1,2}\./.test(restored)) return `\u200B${restored}`;
      return restored;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownDocument(title, siteName, sourceUrl, body) {
  return [`# ${title}`, `> 원문. [${siteName}](${sourceUrl})`, body]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPdfHref(href) {
  return /chatgpt-prompt-codes-100\.pdf(?:$|[?#])/i.test(String(href ?? ""));
}

function rewriteHref(href, origin) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("data:")) {
    return href;
  }
  return stripTracking(href, `${origin}/`);
}

/** 이메일 벽은 빼고, 벽 앞뒤 본문과 PDF 카드를 문서 순서대로 붙인다. */
function codesRoot($) {
  const article = $("article.article").first();
  if (!article.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const heading = article.find("header.article-head h1").first().text().replace(/\s+/g, " ").trim();
  if (heading !== CODES_TITLE) throw new Error(`제목이 다릅니다. ${heading}`);
  const rootNode = $("<div>");
  article.find("header.article-head, div.prose, aside.guide-pdf").each((_, el) => {
    rootNode.append($(el).clone());
  });
  rootNode.find("nav, script, style, noscript, button, svg").remove();
  rootNode.find('a[href*="youtube.com"], a[href*="youtu.be"]').remove();
  rootNode.find(".composer__text").each((_, el) => {
    const text = $(el).text().replace(/^\n+/, "").replace(/\n+$/, "");
    $(el).replaceWith($("<pre>").text(text));
  });
  rootNode.find("a[href]").each((_, link) => {
    const href = $(link).attr("href") || "";
    if (isPdfHref(href)) {
      throw new Error("PDF 링크가 data URL이 아닙니다.");
    }
    $(link).attr("href", rewriteHref(href, CODES_ORIGIN));
  });
  rootNode.find("img").each((_, image) => {
    const src = $(image).attr("src") || "";
    if (!src.startsWith("data:image/")) throw new Error("이미지가 data URL이 아닙니다.");
  });
  rootNode.find("h1").remove();
  return rootNode;
}

/** 챗GPT 코드 100개 글을 마크다운으로 만든다. 첨부 href는 이미 data URL이어야 한다. */
export function codesMarkdownFromHtml(html) {
  const $ = cheerio.load(String(html ?? ""));
  const body = finishMarkdown(createTurndown().turndown(codesRoot($).html() || ""));
  return markdownDocument(CODES_TITLE, "게으른 빌더", CODES_URL, body);
}

/** REA 글의 .wrap을 마크다운으로 만든다. 이미지는 이미 data URL이어야 한다. */
export function reverseMarkdownFromHtml(html) {
  const $ = cheerio.load(String(html ?? ""));
  const wrap = $(".wrap").first();
  if (!wrap.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const heading = wrap.find("h1").first().clone();
  heading.find("br").replaceWith(" ");
  const title = heading.text().replace(/\s+/g, " ").trim();
  if (title !== REVERSE_TITLE) throw new Error(`제목이 다릅니다. ${title}`);
  wrap.find("script, style, noscript").remove();
  dropCopyBars($, wrap);
  wrap.find("img").each((_, image) => {
    const src = $(image).attr("src") || "";
    if (!src.startsWith("data:image/")) throw new Error("이미지가 data URL이 아닙니다.");
    if (!$(image).attr("alt")) $(image).attr("alt", REVERSE_IMAGE_ALT);
  });
  wrap.find("h1").remove();
  wrap.find("a[href]").each((_, link) => {
    const href = $(link).attr("href") || "";
    $(link).attr("href", rewriteHref(href, REVERSE_ORIGIN));
  });
  const body = finishMarkdown(createTurndown().turndown(wrap.html() || ""));
  return markdownDocument(REVERSE_TITLE, "심팀장", REVERSE_URL, body);
}

function visibleText(text) {
  return String(text ?? "").replace(
    /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi,
    "data:"
  );
}

function publicHrefs(hrefs) {
  return [...new Set((hrefs ?? []).filter((href) => !String(href).startsWith("data:")))].sort();
}

function attachmentHrefs(hrefs) {
  return (hrefs ?? []).filter(
    (href) => String(href).startsWith("data:") && !String(href).startsWith("data:image/")
  );
}

function assertPage({ markdown, content, stats, title, sourceUrl, phrases, hrefs, expected, fence }) {
  if (!markdown.startsWith(`# ${title}`)) throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  if (!markdown.includes(sourceUrl) || !content.includes(sourceUrl)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const phrase of phrases) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== expected.images) throw new Error(`이미지 수가 다릅니다. ${stats.images}`);
  if (stats.attachments !== expected.attachments) {
    throw new Error(`첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== expected.tables) throw new Error(`표 수가 다릅니다. ${stats.tables}`);
  if (stats.codes !== expected.codes) throw new Error(`코드 수가 다릅니다. ${stats.codes}`);
  const actual = publicHrefs(stats.hrefs);
  const expectedHrefs = [...hrefs].sort();
  if (
    actual.length !== expectedHrefs.length ||
    actual.some((href, index) => href !== expectedHrefs[index])
  ) {
    throw new Error(`링크가 다릅니다. ${actual.join(" ")}`);
  }
  const files = attachmentHrefs(stats.hrefs);
  if (files.length !== expected.attachments) throw new Error(`첨부 링크 수가 다릅니다. ${files.length}`);
  for (const href of files) {
    const bytes = Buffer.from(href.slice(href.indexOf(",") + 1), "base64");
    if (bytes.length !== PDF_BYTES || sha256(bytes) !== PDF_SHA256) {
      throw new Error("PDF 바이트가 원문과 다릅니다.");
    }
  }
  const plainMarkdown = visibleText(markdown);
  const plainContent = visibleText(content);
  for (const snippet of FORBIDDEN) {
    if (plainMarkdown.includes(snippet) || plainContent.includes(snippet)) {
      throw new Error(`제거 대상이 본문에 남아 있습니다. ${snippet}`);
    }
  }
  if (/^복사$/m.test(markdown) || /^프롬프트 전체 보기$/m.test(markdown)) {
    throw new Error("복사 버튼이 남아 있습니다.");
  }
  const block = markdown.match(/```\n([\s\S]*?)\n```/);
  const body = block?.[1] ?? "";
  if (fence && body !== fence && !body.startsWith(fence)) {
    throw new Error("첫 코드 블록이 다릅니다.");
  }
}

function hashOf(content) {
  return sha256(content);
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    type: response.headers.get("content-type") || "",
    text() {
      return this.bytes.toString("utf8");
    },
  };
}

async function inlineCodesFiles(html) {
  const $ = cheerio.load(html);
  const article = $("article.article").first();
  if (!article.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const images = article.find("img");
  if (images.length !== CODES_EXPECTED.images) {
    throw new Error(`본문 이미지가 ${CODES_EXPECTED.images}이어야 합니다. ${images.length}`);
  }
  for (const image of images.toArray()) {
    const src = $(image).attr("src") || "";
    if (src.startsWith("data:image/")) continue;
    const absolute = new URL(src, CODES_ORIGIN).href;
    const response = await fetchBytes(absolute);
    $(image).attr("src", imageDataUrl(response.bytes, response.type));
  }
  const links = article
    .find("a[href]")
    .toArray()
    .filter((link) => isPdfHref($(link).attr("href") || ""));
  if (links.length !== CODES_EXPECTED.attachments) {
    throw new Error(`PDF 링크가 ${CODES_EXPECTED.attachments}개여야 합니다. ${links.length}`);
  }
  const response = await fetchBytes(new URL(`/guide-pdf/${PDF_NAME}`, CODES_ORIGIN).href);
  if (response.bytes.length !== PDF_BYTES || sha256(response.bytes) !== PDF_SHA256) {
    throw new Error("PDF 바이트가 원문과 다릅니다.");
  }
  const markdown = assertDownloadableAttachment(PDF_NAME, response.bytes, response.type);
  const dataUrl = markdown.slice(markdown.indexOf("(") + 1, markdown.lastIndexOf(")"));
  if (!dataUrl.startsWith("data:application/pdf")) throw new Error("PDF data URL이 아닙니다.");
  for (const link of links) $(link).attr("href", dataUrl);
  return $.html();
}

async function inlineReverseImage(html) {
  const $ = cheerio.load(html);
  const images = $(".wrap img").toArray();
  if (images.length !== REVERSE_EXPECTED.images) {
    throw new Error(`캐릭터 이미지가 ${REVERSE_EXPECTED.images}개여야 합니다. ${images.length}`);
  }
  const image = $(images[0]);
  const src = image.attr("src") || "";
  if (!src.startsWith("data:image/")) {
    const absolute = new URL(src, REVERSE_ORIGIN).href;
    if (absolute.includes("og-reverse.png")) throw new Error("소셜 카드는 본문 이미지가 아닙니다.");
    const response = await fetchBytes(absolute);
    if (response.bytes.length !== PNG_BYTES || sha256(response.bytes) !== PNG_SHA256) {
      throw new Error("캐릭터 이미지 바이트가 원문과 다릅니다.");
    }
    image.attr("src", imageDataUrl(response.bytes, response.type));
  }
  image.attr("alt", image.attr("alt") || REVERSE_IMAGE_ALT);
  return $.html();
}

function pageColumns(db) {
  return db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
}

function sqliteHasFindability(db) {
  const columns = pageColumns(db);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) => columns.includes(name));
}

function findLocalBy(db, column, value) {
  if (!value) return null;
  const columns = pageColumns(db);
  if (column === "source_url" && !columns.includes("source_url")) return null;
  const fields = ["id", "title", "content"];
  if (columns.includes("source_url")) fields.push("source_url");
  return (
    db
      .prepare(
        `SELECT ${fields.join(", ")} FROM custom_pages
         WHERE user_id = ? AND ${column} = ?
         LIMIT 1`
      )
      .get(LOCAL_USER, value) ?? null
  );
}

async function findProdBy(supabase, column, value) {
  if (!value) return null;
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq(column, value)
    .limit(1);
  if (error) {
    if (column === "source_url" && /source_url/i.test(error.message)) return null;
    throw error;
  }
  return data?.[0] ?? null;
}

function titleConflicts(row, title, sourceUrl) {
  return Boolean(row && row.title === title && row.source_url !== sourceUrl);
}

/** 양쪽 저장 여부를 본다. 본문은 받지 않는다. */
async function locate(supabase, title, sourceUrl) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let localSource = null;
  let localTitle = null;
  try {
    localSource = findLocalBy(db, "source_url", sourceUrl);
    localTitle = findLocalBy(db, "title", title);
  } finally {
    db.close();
  }
  const prodSource = await findProdBy(supabase, "source_url", sourceUrl);
  const prodTitle = await findProdBy(supabase, "title", title);
  return { localSource, localTitle, prodSource, prodTitle };
}

function decisionOf(located, title, sourceUrl) {
  const conflict = [located.localTitle, located.prodTitle].find((row) =>
    titleConflicts(row, title, sourceUrl)
  );
  if (conflict) return { action: "skip", pageId: conflict.id, preferredId: null };
  if (located.localSource && located.prodSource) {
    return { action: "skip", pageId: located.localSource.id, preferredId: null };
  }
  return {
    action: "import",
    pageId: located.localSource?.id || located.prodSource?.id || null,
    preferredId: located.localSource?.id || located.prodSource?.id || null,
  };
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
    const existing =
      findLocalBy(db, "source_url", page.sourceUrl) || findLocalBy(db, "title", page.title);
    if (titleConflicts(existing, page.title, page.sourceUrl)) {
      throw new Error("같은 제목의 다른 글이 있어 넣지 않습니다.");
    }
    if (existing && isDuplicateRow(existing, page.title, [page.sourceUrl])) {
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

async function importProduction(supabase, page, libs) {
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing =
    (await findProdBy(supabase, "source_url", page.sourceUrl)) ||
    (await findProdBy(supabase, "title", page.title));
  if (titleConflicts(existing, page.title, page.sourceUrl)) {
    throw new Error("같은 제목의 다른 글이 있어 넣지 않습니다.");
  }
  if (existing && isDuplicateRow(existing, page.title, [page.sourceUrl])) {
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
    id: page.preferredId || randomUUID(),
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
    // 이번 실행에서 넣은 로컬 행만 지운다. 원래 있던 행은 남긴다.
    if (local.pages === 1) {
      const db = new Database(resolve(root, "data/mymark.db"));
      try {
        db.prepare("DELETE FROM custom_pages WHERE id = ? AND user_id = ?").run(record.id, LOCAL_USER);
      } finally {
        db.close();
      }
    }
    throw error;
  }
  return {
    pageId: production.pageId || local.pageId,
    createdAt: now,
    localPages: local.pages,
    localSkips: local.pageSkips,
    prodPages: production.pages,
    prodSkips: production.pageSkips,
  };
}

function emit(payload) {
  const text = JSON.stringify(payload, null, 2);
  if (text.includes("data:")) throw new Error("출력에 data URL이 있습니다.");
  console.log(text);
}

async function buildCodes(libs) {
  const html = (await fetchBytes(CODES_URL)).text();
  const prepared = await inlineCodesFiles(html);
  const markdown = codesMarkdownFromHtml(prepared);
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertPage({
    markdown,
    content,
    stats,
    title: CODES_TITLE,
    sourceUrl: CODES_URL,
    phrases: CODES_PHRASES,
    hrefs: CODES_HREFS,
    expected: CODES_EXPECTED,
    fence: "역할: 챗GPT 코드 사용법을 알려 주는 프롬프트 코치",
  });
  return { markdown, content, stats };
}

async function buildReverse(libs) {
  const html = (await fetchBytes(REVERSE_URL)).text();
  const prepared = await inlineReverseImage(html);
  const markdown = reverseMarkdownFromHtml(prepared);
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertPage({
    markdown,
    content,
    stats,
    title: REVERSE_TITLE,
    sourceUrl: REVERSE_URL,
    phrases: REVERSE_PHRASES,
    hrefs: REVERSE_HREFS,
    expected: REVERSE_EXPECTED,
    fence: "npx rea-agents setup",
  });
  return { markdown, content, stats };
}

const TARGETS = [
  { key: "codes", title: CODES_TITLE, sourceUrl: CODES_URL, build: buildCodes },
  { key: "reverse", title: REVERSE_TITLE, sourceUrl: REVERSE_URL, build: buildReverse },
];

async function main() {
  const checkOnly = process.argv.includes("--check");
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const libs = loadLibs();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const results = [];
  for (const target of TARGETS) {
    const before = decisionOf(
      await locate(supabase, target.title, target.sourceUrl),
      target.title,
      target.sourceUrl
    );
    if (!checkOnly && before.action === "skip") {
      results.push({
        key: target.key,
        action: "skip",
        title: target.title,
        pageId: before.pageId,
        path: `/pages/${before.pageId}`,
        sourceUrl: target.sourceUrl,
        fetched: false,
      });
      continue;
    }
    const built = await target.build(libs);
    const again = decisionOf(
      await locate(supabase, target.title, target.sourceUrl),
      target.title,
      target.sourceUrl
    );
    if (checkOnly) {
      results.push({
        key: target.key,
        action: again.action === "skip" ? "skip" : "check",
        title: target.title,
        sourceUrl: target.sourceUrl,
        images: built.stats.images,
        attachments: built.stats.attachments,
        tables: built.stats.tables,
        codes: built.stats.codes,
        hrefs: publicHrefs(built.stats.hrefs),
        hash: hashOf(built.content),
        length: built.content.length,
      });
      continue;
    }
    if (again.action === "skip") {
      results.push({
        key: target.key,
        action: "skip",
        title: target.title,
        pageId: again.pageId,
        path: `/pages/${again.pageId}`,
        sourceUrl: target.sourceUrl,
        fetched: true,
      });
      continue;
    }
    const saved = await persist(
      supabase,
      {
        title: target.title,
        content: built.content,
        sourceUrl: target.sourceUrl,
        preferredId: again.preferredId,
      },
      libs
    );
    const action = saved.localPages + saved.prodPages > 0 ? "insert" : "skip";
    results.push({
      key: target.key,
      action,
      title: target.title,
      pageId: saved.pageId,
      path: `/pages/${saved.pageId}`,
      sourceUrl: target.sourceUrl,
      images: built.stats.images,
      attachments: built.stats.attachments,
      tables: built.stats.tables,
      codes: built.stats.codes,
      hash: hashOf(built.content),
      length: built.content.length,
      createdAt: saved.createdAt,
      localPages: saved.localPages,
      prodPages: saved.prodPages,
      fetched: true,
    });
  }
  emit({ results });
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
