// every._ai 글 목록에서 아직 없는 글만 Pages에 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_NAME = "every._ai";
export const SITE_ORIGIN = "https://every-ai-guides.vercel.app";
const PROGRESS_PATH = "/tmp/page-import/every-index-progress.log";
const PAUSE_MS = 300;

const TRACKING_KEY = ["fb", "clid"].join("");
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  TRACKING_KEY,
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "from=dm",
  "from=guide",
];
const FROM_VALUES = new Set([
  "dm",
  "dm-hub",
  "guide",
  "guide-top",
  "littly",
  "column",
  "money-map",
]);
const FORBIDDEN_SNIPPETS = [
  TRACKING_KEY,
  "utm_source",
  "from=dm",
  "from=guide",
  "from=littly",
  "AI 수익화 챌린지",
  "instagram.com/every",
  "claude-icon.png",
];
const CHROME_SELECTOR = [
  "a.bootcamp-post-banner",
  ".challenge-post-banner",
  "a.challenge-post-banner",
  "a.kakao-post-cta",
  "section.challenge-banner",
  "nav",
  "footer",
  "button",
  "script",
  "style",
  "noscript",
  "img[src*='claude-icon']",
  "a[href*='instagram.com/every']",
].join(", ");

const envPath = resolve(root, [".", "env", ".local"].join(""));
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

function note(line) {
  mkdirSync(dirname(PROGRESS_PATH), { recursive: true });
  appendFileSync(PROGRESS_PATH, `${line}\n`);
}

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === TRACKING_KEY ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1") ||
    key === "gclid" ||
    (key === "from" && FROM_VALUES.has(value))
  );
}

/** localhost가 아니면 http를 https로 올린다. */
function upgradeHttp(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (
      parsed.protocol === "http:" &&
      host !== "localhost" &&
      host !== "127.0.0.1"
    ) {
      parsed.protocol = "https:";
    }
    return parsed.href;
  } catch {
    return url;
  }
}

/** 유입 추적 쿼리를 빼고 절대 주소로 바꾼다. */
export function stripTracking(url, base) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) {
    return url;
  }
  try {
    const parsed = new URL(url, base);
    for (const key of [...parsed.searchParams.keys()]) {
      const values = parsed.searchParams.getAll(key);
      if (values.some((value) => isTrackingParam(key, value))) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return String(url)
      .replace(
        new RegExp(
          `[?&](?:utm_[^=&#]*|${TRACKING_KEY}|pvs|igsh|mcp_token)=[^&\\s)#]*`,
          "g"
        ),
        ""
      )
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]m=1(?=[&#]|$)/g, "")
      .replace(
        /[?&]from=(?:dm-hub|guide-top|money-map|littly|column|dm|guide)(?=[&#]|$)/g,
        ""
      )
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** 글 원문 주소에서 .html과 끝 슬래시를 뺀다. */
export function canonicalPostUrl(url) {
  const absolute = stripTracking(String(url || ""), `${SITE_ORIGIN}/`);
  const parsed = new URL(absolute);
  parsed.hash = "";
  parsed.search = "";
  let path = parsed.pathname.replace(/\/+$/, "");
  if (/\.html$/i.test(path)) path = path.slice(0, -5);
  return `${parsed.origin}${path}`;
}

function storedSourceUrl(url) {
  return canonicalPostUrl(url);
}

/** 중복 비교용 원문 주소. .html이 붙어 저장된 행도 같은 글이다. */
export function sourceMarkers(sourceUrl) {
  const canonical = storedSourceUrl(sourceUrl);
  return [canonical, `${canonical}.html`];
}

function linkBaseOf(url) {
  return `${storedSourceUrl(url)}/`;
}

function toAbsoluteUrl(url, base) {
  if (
    !url ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("#")
  ) {
    return url;
  }
  return upgradeHttp(stripTracking(url, base));
}

/** 제목 또는 원문 주소가 정확히 같으면 중복이다. */
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

/** 같은 호스트 PDF만 첨부 data URL로 만들고 ZIP은 링크다. */
export function attachmentKind(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "link";
  }
  if (parsed.hostname !== "every-ai-guides.vercel.app") return "link";
  if (/\.pdf$/i.test(parsed.pathname)) return "pdf";
  if (/\.zip$/i.test(parsed.pathname)) return "zip";
  return "link";
}

/** 이미지 바이트를 data URL로 바꾼다. */
export function imageDataUrl(bytes, header) {
  const mime = imageMime(bytes, header);
  if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime)) {
    throw new Error("본문 이미지 MIME이 허용되지 않습니다.");
  }
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

/** 목록 HTML에서 글 카드만 읽는다. 쇼츠 공장과 메뉴는 글이 아니다. */
export function postsFromIndex(html) {
  const $ = cheerio.load(html);
  const cards = $("a.card").toArray();
  const seen = new Set();
  const posts = [];
  for (const card of cards) {
    const raw = $(card).attr("href") || "";
    const parsed = new URL(stripTracking(raw, `${SITE_ORIGIN}/`));
    const match = /^\/posts\/([a-z0-9-]+)\.html$/.exec(parsed.pathname);
    if (!match) {
      throw new Error(`글 카드 주소를 읽지 못했습니다. ${parsed.pathname}`);
    }
    const slug = match[1];
    if (seen.has(slug)) throw new Error(`글 카드가 중복입니다. ${slug}`);
    seen.add(slug);
    const title = $(card).find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!title) throw new Error(`글 카드 제목이 없습니다. ${slug}`);
    posts.push({
      slug,
      title,
      sourceUrl: `${SITE_ORIGIN}/posts/${slug}`,
    });
  }
  if (!posts.length) throw new Error("글 카드를 찾지 못했습니다.");
  return posts;
}

function hasNoExpiredUrl(text) {
  const value = visibleText(text);
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

function visibleText(text) {
  return String(text ?? "").replace(
    /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi,
    "data:"
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

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
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

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.addRule("strikethrough", {
    filter: ["del", "s", "strike"],
    replacement(content) {
      const text = String(content).replace(/\s+/g, " ").trim();
      if (!text) return "";
      return `~~${text}~~`;
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
            cells.push(cellText($table, cell));
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

function cellText($, cell) {
  const clone = $(cell).clone();
  clone.find("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href") || "";
    const label =
      $(anchor).text().replace(/\s+/g, " ").replace(/[\[\]]/g, "").trim() ||
      href;
    $(anchor).replaceWith(`[${label}](${href})`);
  });
  return clone
    .text()
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function mapFencedLines(markdown, outside, inside) {
  const lines = String(markdown ?? "").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^(```+|~~~+)/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      return inFence ? inside(line) : outside(line);
    })
    .join("\n");
}

function rewriteUrlOutside(url, base) {
  return upgradeHttp(stripTracking(url, base));
}

/** 펜스 밖 날짜 줄은 순서 목록으로 먹히지 않게 폭 없는 문자를 붙인다. */
function protectDateLines(markdown) {
  const lines = String(markdown ?? "").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^(```+|~~~+)/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      if (/^\u200B/.test(line)) return line;
      if (/^\d{4}\.\s+\d{1,2}\./.test(line)) return `\u200B${line}`;
      return line;
    })
    .join("\n");
}

function cleanWebMarkdown(markdown, base) {
  const rewritten = mapFencedLines(
    markdown,
    (line) =>
      line
        .replace(/\\([\[\]\.])/g, "$1")
        .replace(
          /\]\((\/[^)]+)\)/g,
          (_, path) => `](${rewriteUrlOutside(path, base)})`
        )
        .replace(/https?:\/\/[^\s)]+/g, (url) => rewriteUrlOutside(url, base)),
    (line) => line.replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url))
  );
  return protectDateLines(rewritten).replace(/\n{3,}/g, "\n\n").trim();
}

function rewriteLinks($, root, sourceUrl) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:")) return;
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
}

function pageTitleOf($) {
  const h1 = $("article.post h1").first();
  const raw = h1.length ? h1.text() : "";
  const text = String(raw)
    .replace(/\s+/g, " ")
    .replace(/\s*[—–-]\s*every\._ai\s*$/i, "")
    .trim();
  if (!text) throw new Error("제목을 찾지 못했습니다.");
  return text;
}

function stripChrome($, root) {
  root.find(CHROME_SELECTOR).remove();
  root.find("h2").each((_, heading) => {
    const node = $(heading);
    if (node.text().replace(/\s+/g, " ").trim() !== "함께 보면 좋은 글") return;
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

function selectContent($) {
  const article = $("article.post").first();
  if (!article.length) {
    throw new Error("본문 영역 article.post 를 찾지 못했습니다.");
  }
  const content = article.clone();
  stripChrome($, content);
  separateMetaSpans($, content);
  separateStepSpans($, content);
  return content;
}

function imageSlotToken(index) {
  return `EVIMG${index}TOKEN`;
}

function fileSlotToken(index) {
  return `EVFILE${index}TOKEN`;
}

function isContentImageSrc(src) {
  if (!src) return false;
  if (src.includes("claude-icon") || src.includes("favicon")) return false;
  return true;
}

function bytesFromImageDataUrl(dataUrl) {
  const match =
    /^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      String(dataUrl)
    );
  if (!match) throw new Error("이미지 data URL이 아닙니다.");
  return Buffer.from(match[1], "base64");
}

function stashBodyImages($, content) {
  const slots = [];
  for (const image of [...content.find("img").toArray()]) {
    const src = imageSrcOf(image, $);
    if (!isContentImageSrc(src)) {
      $(image).remove();
      continue;
    }
    if (!src.startsWith("data:image/")) {
      throw new Error("본문 이미지가 data URL이 아닙니다.");
    }
    const bytes = bytesFromImageDataUrl(src);
    imageMime(bytes);
    const alt = String($(image).attr("alt") || "")
      .replace(/[\[\]\r\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    slots.push({ alt, dataUrl: src });
    $(image).replaceWith(`<p>${imageSlotToken(slots.length - 1)}</p>`);
  }
  return slots;
}

function stashFileLinks($, content) {
  const slots = [];
  for (const link of [...content.find("a[href]").toArray()]) {
    const href = $(link).attr("href") || "";
    if (!href.startsWith("data:") || href.startsWith("data:image/")) continue;
    const text =
      $(link).text().replace(/\s+/g, " ").replace(/[\[\]]/g, "").trim() ||
      "첨부";
    slots.push({ text, dataUrl: href });
    $(link).replaceWith(fileSlotToken(slots.length - 1));
  }
  return slots;
}

function restoreSlots(markdown, slots, tokenOf, render) {
  let result = String(markdown);
  slots.forEach((slot, index) => {
    const token = tokenOf(index);
    const rendered = render(slot);
    const forms = [
      `***${token}***`,
      `**${token}**`,
      `~~${token}~~`,
      `\`${token}\``,
      `*${token}*`,
      token,
    ];
    if (!forms.some((form) => result.includes(form))) {
      throw new Error("자리표시가 없습니다.");
    }
    for (const form of forms) {
      if (!result.includes(form)) continue;
      result = result.split(form).join(rendered);
    }
  });
  return result;
}

/** 가이드 HTML을 저장용 마크다운으로 바꾼다. 네트워크는 쓰지 않는다. */
export function parseEveryAiHtml(html, sourceUrl, options = {}) {
  const allowSnippets = new Set(options.allowSnippets ?? []);
  const storedUrl = storedSourceUrl(sourceUrl);
  const base = linkBaseOf(storedUrl);
  const $ = cheerio.load(html);
  const content = selectContent($);
  const title = pageTitleOf($);
  content.find("h1").first().remove();
  rewriteLinks($, content, base);
  const imageSlots = stashBodyImages($, content);
  const fileSlots = stashFileLinks($, content);
  const htmlForMarkdown = content.html() || "";
  if (content.find("[src^='data:'], [href^='data:']").length) {
    throw new Error("data URL이 마크다운 변환 입력에 남아 있습니다.");
  }
  const articleMarkdown = createTurndown().turndown(htmlForMarkdown).trim();
  const cleaned = cleanWebMarkdown(articleMarkdown, base);
  const withImages = restoreSlots(
    cleaned,
    imageSlots,
    imageSlotToken,
    (slot) => `![${slot.alt}](${slot.dataUrl})`
  );
  const withFiles = restoreSlots(
    withImages,
    fileSlots,
    fileSlotToken,
    (slot) => `[${slot.text}](${slot.dataUrl})`
  );
  const markdown = [
    `# ${title}`,
    `> 원문. [${SITE_NAME}](${storedUrl})`,
    withFiles,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const plain = visibleText(markdown);
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (allowSnippets.has(snippet)) continue;
    if (plain.includes(snippet)) {
      throw new Error(`제거 대상이 본문에 남아 있습니다. ${snippet}`);
    }
  }
  if (/EVIMG\d+TOKEN|EVFILE\d+TOKEN/.test(markdown)) {
    throw new Error("자리표시가 남아 있습니다.");
  }
  return { title, markdown };
}

function collectPlan($, content, sourceUrl) {
  const base = linkBaseOf(sourceUrl);
  let images = 0;
  for (const image of content.find("img").toArray()) {
    if (isContentImageSrc(imageSrcOf(image, $))) images += 1;
  }
  const pdfs = [];
  const zips = [];
  const links = [];
  for (const link of content.find("a[href]").toArray()) {
    const href = $(link).attr("href") || "";
    if (
      !href ||
      href.startsWith("mailto:") ||
      href.startsWith("#") ||
      href.startsWith("data:")
    ) {
      continue;
    }
    const abs = toAbsoluteUrl(href, base);
    const kind = attachmentKind(abs);
    if (kind === "pdf") pdfs.push(abs);
    else if (kind === "zip") zips.push(abs);
    else if (/^https?:\/\//.test(abs)) links.push(abs);
  }
  return {
    images,
    pdfs,
    zips,
    links,
    tables: content.find("table").length,
    codes: content.find("pre").length,
  };
}

async function fetchWithRetry(url, referer) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: referer || url,
      },
    });
    if (response.ok) return response;
    lastStatus = response.status;
    if (response.status !== 429 && response.status !== 503) break;
    await pause(1000 * (attempt + 1));
  }
  throw new Error(`HTTP ${lastStatus}. ${new URL(url).pathname}`);
}

async function inlineBodyImages($, content, sourceUrl) {
  for (const image of [...content.find("img").toArray()]) {
    let imageUrl = imageSrcOf(image, $);
    if (!isContentImageSrc(imageUrl)) {
      $(image).remove();
      continue;
    }
    if (imageUrl.startsWith("data:image/")) {
      imageMime(bytesFromImageDataUrl(imageUrl));
      $(image).removeAttr("srcset");
      continue;
    }
    imageUrl = toAbsoluteUrl(imageUrl, linkBaseOf(sourceUrl));
    const response = await fetchWithRetry(imageUrl, sourceUrl);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const dataUrl = imageDataUrl(bytes, response.headers.get("content-type"));
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
  }
}

async function inlineAttachments($, content, sourceUrl) {
  const base = linkBaseOf(sourceUrl);
  for (const link of [...content.find("a[href]").toArray()]) {
    const href = $(link).attr("href") || "";
    if (
      !href ||
      href.startsWith("data:") ||
      href.startsWith("mailto:") ||
      href.startsWith("#")
    ) {
      continue;
    }
    const abs = toAbsoluteUrl(href, base);
    $(link).attr("href", abs);
    if (attachmentKind(abs) !== "pdf") continue;
    const filename = filenameFromUrl(abs) || "첨부.pdf";
    const response = await fetchWithRetry(abs, sourceUrl);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const markdown = assertDownloadableAttachment(
      filename,
      bytes,
      response.headers.get("content-type")
    );
    const match = /^\[[^\]]*\]\((data:[^)]+)\)$/.exec(markdown);
    if (!match || !match[1].startsWith("data:application/pdf")) {
      throw new Error("PDF data URL이 아닙니다.");
    }
    $(link).attr("href", match[1]);
    if (!$(link).text().trim()) $(link).text(filename);
  }
}

export function assertImported({
  title,
  markdown,
  stats,
  content,
  plan,
  sourceUrl,
  allowSnippets = [],
}) {
  const allowed = new Set(allowSnippets);
  const stored = storedSourceUrl(sourceUrl);
  if (!markdown.startsWith(`# ${title}`)) {
    throw new Error("첫 헤딩이 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [${SITE_NAME}](${stored})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  if (stats.images !== plan.images) {
    throw new Error(`이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== plan.pdfs.length) {
    throw new Error(`첨부 수가 다릅니다. ${stats.attachments}`);
  }
  const plainMarkdown = visibleText(markdown);
  const plainContent = visibleText(content);
  if (
    markdown.includes("data:application/zip") ||
    content.includes("data:application/zip")
  ) {
    throw new Error("ZIP data URL이 있습니다.");
  }
  for (const zip of plan.zips) {
    if (!markdown.includes(zip) && !content.includes(zip)) {
      throw new Error(`ZIP 링크가 없습니다. ${zip}`);
    }
  }
  for (const link of plan.links) {
    if (!markdown.includes(link) && !content.includes(link)) {
      throw new Error(`링크가 없습니다. ${link}`);
    }
  }
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (allowed.has(snippet)) continue;
    if (plainMarkdown.includes(snippet) || plainContent.includes(snippet)) {
      throw new Error(`제거 대상이 저장 본문에 남아 있습니다. ${snippet}`);
    }
  }
  if (
    /EVIMG\d+TOKEN|EVFILE\d+TOKEN/.test(markdown) ||
    /EVIMG\d+TOKEN|EVFILE\d+TOKEN/.test(content)
  ) {
    throw new Error("자리표시가 남아 있습니다.");
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
}

export async function buildImportedPage(sourceUrl, htmlOverride = "", options = {}) {
  const html = htmlOverride
    ? htmlOverride
    : await (await fetchWithRetry(storedSourceUrl(sourceUrl), SITE_ORIGIN)).text();
  const $ = cheerio.load(html);
  const article = $("article.post").first();
  if (!article.length) throw new Error("본문 영역 article.post 를 찾지 못했습니다.");
  stripChrome($, article);
  separateMetaSpans($, article);
  separateStepSpans($, article);
  const plan = collectPlan($, article, sourceUrl);
  await inlineBodyImages($, article, sourceUrl);
  await inlineAttachments($, article, sourceUrl);
  const parsed = parseEveryAiHtml($.html(), sourceUrl, options);
  return { ...parsed, plan, allowSnippets: options.allowSnippets ?? [] };
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

function pageColumns(db) {
  return db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
}

function loadLocalRows(db) {
  const cols = pageColumns(db);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  return db
    .prepare(
      `SELECT ${fields.join(", ")} FROM custom_pages WHERE user_id = ?`
    )
    .all(LOCAL_USER);
}

function findLocalPage(db, title, markers) {
  return findRow(loadLocalRows(db), title, markers);
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

export async function loadProductionRows(supabase) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
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
    if (!marker) continue;
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

async function importProduction(page, markers, libs) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
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

export async function persist(page, libs, preferredId) {
  const now = new Date().toISOString();
  const record = {
    id: preferredId || randomUUID(),
    title: page.title,
    content: page.content,
    sourceUrl: page.sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const markers = sourceMarkers(page.sourceUrl);
  const local = importLocal(record, markers, libs);
  record.id = local.pageId;
  let production;
  try {
    production = await importProduction(record, markers, libs);
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
  const pageId = production.pageSkips ? production.pageId : local.pageId;
  return {
    pageId: pageId || local.pageId,
    localPages: local.pages,
    localSkips: local.pageSkips,
    prodPages: production.pages,
    prodSkips: production.pageSkips,
    createdAt: now,
  };
}

function sourceHit(rows, markers) {
  return (
    (rows ?? []).find((row) =>
      markers.some((marker) => marker && row.source_url === marker)
    ) ?? null
  );
}

/** 같은 원문이면 없는 쪽에만 넣고, 제목만 같은 다른 글은 건너뛴다. */
export function decideSkip(localRows, prodRows, title, markers) {
  const localSource = sourceHit(localRows, markers);
  const prodSource = sourceHit(prodRows, markers);
  if (localSource && prodSource) {
    return {
      skip: true,
      title: localSource.title,
      pageId: localSource.id,
      preferredId: null,
    };
  }
  const titleRow = (rows) =>
    title ? (rows ?? []).find((row) => row.title === title) ?? null : null;
  const localTitle = titleRow(localRows);
  const prodTitle = titleRow(prodRows);
  const otherTitle =
    (localTitle && !markers.includes(localTitle.source_url) && localTitle) ||
    (prodTitle && !markers.includes(prodTitle.source_url) && prodTitle) ||
    null;
  if (otherTitle) {
    return {
      skip: true,
      title: otherTitle.title,
      pageId: otherTitle.id,
      preferredId: null,
    };
  }
  const same = localSource || prodSource;
  if (same) {
    return {
      skip: false,
      title: same.title,
      pageId: same.id,
      preferredId: same.id,
    };
  }
  return { skip: false, title, pageId: null, preferredId: null };
}

function summaryOf(post, extra) {
  return {
    slug: post.slug,
    title: extra.title,
    pageId: extra.pageId ?? null,
    images: extra.images ?? null,
    attachments: extra.attachments ?? null,
    codes: extra.codes ?? null,
    tables: extra.tables ?? null,
    action: extra.action,
  };
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
  const indexHtml = await (
    await fetchWithRetry(`${SITE_ORIGIN}/`, SITE_ORIGIN)
  ).text();
  const posts = postsFromIndex(indexHtml);
  const localDb = new Database(resolve(root, "data/mymark.db"), {
    readonly: true,
  });
  const localRows = loadLocalRows(localDb);
  localDb.close();
  const prodRows = await loadProductionRows(supabase);
  const pages = [];
  let skipCount = 0;
  let insertCount = 0;
  for (const post of posts) {
    const markers = sourceMarkers(post.sourceUrl);
    const decision = decideSkip(localRows, prodRows, post.title, markers);
    if (decision.skip) {
      skipCount += 1;
      pages.push(
        summaryOf(post, {
          title: decision.title,
          pageId: decision.pageId,
          action: "skip",
        })
      );
      note(`skip ${post.slug}`);
      continue;
    }
    await pause(PAUSE_MS);
    note(`fetch ${post.slug}`);
    const built = await buildImportedPage(post.sourceUrl);
    const doc = libs.markdownToTiptapDoc(built.markdown);
    const content = JSON.stringify(doc);
    const stats = documentStats(content);
    assertImported({
      title: built.title,
      markdown: built.markdown,
      stats,
      content,
      plan: built.plan,
      sourceUrl: post.sourceUrl,
    });
    const again = decideSkip(localRows, prodRows, built.title, markers);
    if (again.skip) {
      skipCount += 1;
      pages.push(
        summaryOf(post, {
          title: again.title,
          pageId: again.pageId,
          images: stats.images,
          attachments: stats.attachments,
          codes: stats.codes,
          tables: stats.tables,
          action: "skip",
        })
      );
      note(`skip ${post.slug}`);
      continue;
    }
    if (checkOnly) {
      pages.push(
        summaryOf(post, {
          title: built.title,
          images: stats.images,
          attachments: stats.attachments,
          codes: stats.codes,
          tables: stats.tables,
          action: "check",
        })
      );
      note(`check ${post.slug} images=${stats.images} files=${stats.attachments}`);
      continue;
    }
    const preferredId = again.preferredId;
    const saved = await persist(
      {
        title: built.title,
        content,
        sourceUrl: storedSourceUrl(post.sourceUrl),
      },
      libs,
      preferredId
    );
    const action = saved.localPages + saved.prodPages > 0 ? "insert" : "skip";
    if (action === "insert") insertCount += 1;
    else skipCount += 1;
    if (saved.localPages) {
      localRows.push({
        id: saved.pageId,
        title: built.title,
        source_url: storedSourceUrl(post.sourceUrl),
      });
    }
    if (saved.prodPages) {
      prodRows.push({
        id: saved.pageId,
        title: built.title,
        source_url: storedSourceUrl(post.sourceUrl),
      });
    }
    pages.push(
      summaryOf(post, {
        title: built.title,
        pageId: saved.pageId,
        images: stats.images,
        attachments: stats.attachments,
        codes: stats.codes,
        tables: stats.tables,
        action,
      })
    );
    note(
      `${action} ${post.slug} images=${stats.images} files=${stats.attachments}`
    );
  }
  const output = {
    indexCount: posts.length,
    skipCount,
    insertCount,
    pages,
  };
  const text = JSON.stringify(output);
  if (text.includes("data:")) throw new Error("출력에 data URL이 있습니다.");
  console.log(text);
  note(`done index=${posts.length} skip=${skipCount} insert=${insertCount}`);
}

const isDirect =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
