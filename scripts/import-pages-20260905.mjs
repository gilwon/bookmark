// Blogspot 클로드 5 골든 룰과 한국시간 이번 주 Notion 신규 3건을 Pages에만 저장한다
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

export const IMAGE_BYTES = {
  "tmp/notion-kst-20260905/privacy/01-hero-chatgpt-privacy.png": 239581,
  "tmp/notion-kst-20260905/privacy/02-process-flow.png": 155020,
  "tmp/notion-kst-20260905/privacy/07-prompt-editor.png": 224264,
  "tmp/notion-kst-20260905/hormozi/step1.png": 65827,
  "tmp/notion-kst-20260905/hormozi/step2.png": 112825,
  "tmp/notion-kst-20260905/hormozi/step3.png": 105237,
  "tmp/notion-kst-20260905/hormozi/step4.png": 115765,
};

export const TARGETS = [
  {
    key: "blogspot-claude5",
    title:
      "앤트로픽(Anthropic) 공식 공개: 클로드 5(Claude 5) 프롬프트 작성 7가지 골든 룰",
    sourceUrl:
      "https://jwchaainews.blogspot.com/2026/09/anthropic-5claude-5-7.html",
    kind: "web",
    label: "현직연구원",
    images: 0,
    attachments: 0,
    codes: 2,
    tables: 1,
    phrases: [
      "End-to-End",
      "[JOB]",
      "Interview Me",
      "DONE LOOKS LIKE",
      "Keep responses focused, brief, and concise.",
    ],
  },
  {
    key: "privacy",
    title: "인터넷에 퍼진 내 개인정보 싹 지우는 법 (ChatGPT Work 완벽 가이드)",
    hex: "afdb256827ac834aaa1101b008fa23a5",
    pageId: "afdb2568-27ac-834a-aa11-01b008fa23a5",
    sourceUrl: "https://app.notion.com/p/afdb256827ac834aaa1101b008fa23a5",
    kind: "notion",
    label: "Notion",
    body: "tmp/notion-kst-20260905/privacy.md",
    images: 3,
    attachments: 0,
    codes: 8,
    imageFiles: [
      "tmp/notion-kst-20260905/privacy/01-hero-chatgpt-privacy.png",
      "tmp/notion-kst-20260905/privacy/02-process-flow.png",
      "tmp/notion-kst-20260905/privacy/07-prompt-editor.png",
    ],
    phrases: [
      "ChatGPT Work",
      "내 디지털 흔적 전수 조사 프롬프트",
      "개인정보보호법 제36조",
      "Have I Been Pwned",
    ],
  },
  {
    key: "subsidy",
    title: "내 지원금 찾기 프롬프트(비개발자 가이드)",
    hex: "b49b256827ac83b39d3e017c7f502113",
    pageId: "b49b2568-27ac-83b3-9d3e-017c7f502113",
    sourceUrl: "https://app.notion.com/p/b49b256827ac83b39d3e017c7f502113",
    kind: "notion",
    label: "Notion",
    body: "tmp/notion-kst-20260905/subsidy.md",
    images: 0,
    attachments: 0,
    codes: 1,
    phrases: [
      "너는 대한민국 정부·지자체 지원금 상담 전문가야.",
      "보조금24",
      "STEP 1. 프롬프트 복사하기",
      "pokki.xyz",
    ],
  },
  {
    key: "hormozi",
    title: "Claude 안에 홀모지식 사고를 심는 법 — 10분 세팅 가이드",
    hex: "e67b256827ac823f8c9281fdca374fc1",
    pageId: "e67b2568-27ac-823f-8c92-81fdca374fc1",
    sourceUrl: "https://app.notion.com/p/e67b256827ac823f8c9281fdca374fc1",
    kind: "notion",
    label: "Notion",
    body: "tmp/notion-kst-20260905/hormozi.md",
    images: 4,
    attachments: 0,
    codes: 6,
    imageFiles: [
      "tmp/notion-kst-20260905/hormozi/step1.png",
      "tmp/notion-kst-20260905/hormozi/step2.png",
      "tmp/notion-kst-20260905/hormozi/step3.png",
      "tmp/notion-kst-20260905/hormozi/step4.png",
    ],
    phrases: ["$100M Offers", "6M 프레임워크", "코어4", "지식팩"],
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
    let removed = false;
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (isTrackingParam(key, value)) {
        parsed.searchParams.delete(key);
        removed = true;
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    if (!removed && /^(https?:)/i.test(url)) return url;
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

function restoreProtected(node) {
  if (typeof node.text === "string") {
    node.text = node.text
      .replace(/%%NOTION_LT%%/g, "<")
      .replace(/%%NOTION_GT%%/g, ">");
  }
  for (const child of node.content ?? []) restoreProtected(child);
}

function stripNodeHrefs(node) {
  if (!node || typeof node !== "object") return;
  for (const mark of node.marks ?? []) {
    if (mark?.type === "link" && mark.attrs?.href) {
      mark.attrs.href = stripTracking(mark.attrs.href);
    }
  }
  if (node.type === "image" && node.attrs?.src) {
    const src = String(node.attrs.src);
    if (!src.startsWith("data:")) node.attrs.src = stripTracking(src);
  }
  for (const child of node.content ?? []) stripNodeHrefs(child);
}

function rewriteMarkdownHrefs(markdown) {
  return String(markdown)
    .replace(
      /\]\((https?:\/\/[^)\s]+)\)/g,
      (_match, url) => `](${stripTracking(url)})`
    )
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url));
}

function localImageMime(bytes) {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  return imageMime(bytes);
}

function localImageDataUrl(relPath) {
  const file = resolve(root, relPath);
  if (!existsSync(file)) throw new Error(`이미지 파일이 없습니다. ${relPath}`);
  const bytes = readFileSync(file);
  const expected = IMAGE_BYTES[relPath];
  if (expected != null && bytes.length !== expected) {
    throw new Error(`이미지 크기가 다릅니다. ${relPath} ${bytes.length}`);
  }
  const mime = localImageMime(bytes);
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  if (!dataUrl.startsWith("data:image")) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("이미지에 만료 URL이 남아 있습니다.");
  }
  return dataUrl;
}

function inlineLocalMarkdownImages(markdown, spec) {
  const expected = new Set(spec.imageFiles ?? []);
  const used = new Set();
  const out = String(markdown).replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt, src) => {
      const trimmed = String(src).trim();
      if (trimmed.startsWith("data:")) return `![${alt}](${trimmed})`;
      if (/^(https?:|mailto:)/i.test(trimmed)) return `![${alt}](${trimmed})`;
      const rel = trimmed.replace(/^\.\//, "");
      used.add(rel);
      return `![${alt}](${localImageDataUrl(rel)})`;
    }
  );
  for (const path of expected) {
    if (!used.has(path)) {
      throw new Error(`이미지를 본문에서 찾지 못했습니다. ${path}`);
    }
  }
  if (/!\[([^\]]*)\]\((?!data:)([^)]*tmp\/[^)]+)\)/.test(out)) {
    throw new Error("로컬 이미지 경로가 남아 있습니다.");
  }
  return out;
}

function assertNoZip(text) {
  if (/\]\([^)]*\.zip(?:[?#][^)]*)?\)/i.test(String(text ?? ""))) {
    throw new Error(
      "ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다."
    );
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

function sourceLabelOf(spec) {
  return spec.kind === "notion" ? "Notion" : spec.label;
}

function buildPageMarkdown(spec, body, cover = "") {
  const sourceUrl = stripTracking(spec.sourceUrl);
  return rewriteMarkdownHrefs(
    [`# ${spec.title}`, `> 원문. [${sourceLabelOf(spec)}](${sourceUrl})`, cover, body]
      .filter(Boolean)
      .join("\n\n")
      .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function isStyleCodeBox($, node) {
  const style = String(node.attr("style") || "");
  if (node.find("table, pre").length) return false;
  if (/Consolas|monospace/i.test(style)) return true;
  const text = node.text();
  return (
    /overflow-x/i.test(style) &&
    (text.includes("// Claude 5 표준 프롬프트 구조 (E2E Framework)") ||
      text.includes("// Global Voice Control Instructions 예시"))
  );
}

function fenceStyleCodeBoxes($, content) {
  const boxes = content
    .find("div")
    .toArray()
    .filter((el) => {
      const node = $(el);
      if (!isStyleCodeBox($, node)) return false;
      return !node
        .parents("div")
        .toArray()
        .some((parent) => isStyleCodeBox($, $(parent)));
    });
  for (const el of boxes) {
    const node = $(el);
    const text = node.text().replace(/^\n+/, "").replace(/\n+$/, "");
    node.replaceWith($("<pre>").text(text));
  }
}

function rewriteLinks($, content, sourceUrl) {
  content.find("a[href]").each((_, link) => {
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

function selectBlogContent($) {
  const content = $("div.post-body.entry-content").first().length
    ? $("div.post-body.entry-content").first()
    : $("div.post-body").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
  content
    .find(
      "script, style, button, #comments, .comments, .comment-form, .post-share-buttons, .sharing, .widget.PopularPosts"
    )
    .remove();
  return content;
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

function mediaMime(bytes, header) {
  try {
    return localImageMime(bytes);
  } catch {
    if (header?.startsWith("image/")) return header.split(";")[0];
    throw new Error("이미지 MIME을 판별하지 못했습니다.");
  }
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
    imageUrl = new URL(imageUrl, sourceUrl).href;
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

function parseBlogContent($, content, spec) {
  const canonical = stripTracking(spec.sourceUrl);
  const h1 = content.find("article h1").first();
  const titleFromH1 = h1.text().replace(/\s+/g, " ").trim();
  if (titleFromH1 === "최신 AI 뉴스") {
    throw new Error("사이트 타이틀을 본문 제목으로 썼습니다.");
  }
  if (titleFromH1 && titleFromH1 !== spec.title) {
    throw new Error(`페이지 제목이 다릅니다. ${titleFromH1}`);
  }
  h1.remove();
  content.find("script, style, button").remove();
  fenceStyleCodeBoxes($, content);
  if (spec.codes != null && content.find("pre").length !== spec.codes) {
    throw new Error(
      `코드상자가 ${spec.codes}개가 아닙니다. ${content.find("pre").length}`
    );
  }
  if (spec.images === 0 && content.find("img").length !== 0) {
    throw new Error(`본문 이미지가 0이어야 합니다. ${content.find("img").length}`);
  }
  rewriteLinks($, content, canonical);
  const fences = fencePrePlaceholders($, content);
  const articleMarkdown = restorePreFences(
    createTurndown().turndown(content.html() || "").trim(),
    fences
  );
  const cleaned = cleanWebMarkdown(articleMarkdown, canonical);
  const markdown = buildPageMarkdown(spec, cleaned);
  return { title: spec.title, markdown };
}

/** Blogspot 본문 HTML을 저장용 마크다운으로 바꾼다. */
export function parseBlogspotHtml(html, spec = TARGETS[0]) {
  const $ = cheerio.load(protectPreBlocks(html));
  const content = selectBlogContent($);
  return parseBlogContent($, content, spec);
}

function cleanBody(spec) {
  const bodyFile = resolve(root, spec.body);
  if (!existsSync(bodyFile)) throw new Error(`본문 파일이 없습니다. ${spec.body}`);
  let body = rewriteMarkdownHrefs(readFileSync(bodyFile, "utf8").trim());
  body = inlineLocalMarkdownImages(body, spec);
  assertNoZip(body);
  if (!hasNoExpiredUrl(body)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (
    /prod-files-secure|X-Amz|file\.notion\.so|blob:|fbclid|utm_source/.test(body)
  ) {
    throw new Error("금지된 URL 조각이 본문에 남아 있습니다.");
  }
  return body;
}

function assertRecord(spec, markdown, content, stats) {
  const sourceUrl = stripTracking(spec.sourceUrl);
  if (!markdown.startsWith(`# ${spec.title}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [${sourceLabelOf(spec)}](${sourceUrl})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  if (!content.includes(sourceUrl) && !(spec.hex && content.includes(spec.hex))) {
    throw new Error(`원문 주소가 없습니다. ${spec.title}`);
  }
  for (const phrase of spec.phrases ?? []) {
    if (!markdown.includes(phrase)) {
      throw new Error(`문구가 없습니다. ${phrase}`);
    }
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (
    /prod-files-secure|X-Amz|file\.notion\.so|blob:|fbclid|utm_source/.test(
      markdown
    ) ||
    /prod-files-secure|X-Amz|file\.notion\.so|blob:|fbclid|utm_source/.test(
      content
    )
  ) {
    throw new Error("금지된 URL 조각이 저장 본문에 남아 있습니다.");
  }
  assertNoZip(markdown);
  if (stats.images !== spec.images) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== spec.attachments) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (spec.codes != null && stats.codes !== spec.codes) {
    throw new Error(`TipTap 코드 수가 다릅니다. ${stats.codes}`);
  }
  if (spec.tables != null && stats.tables !== spec.tables) {
    throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== spec.images) {
    throw new Error(`본문 이미지 수가 다릅니다. ${sources.length}`);
  }
  for (const src of sources) {
    if (!src.startsWith("data:image")) {
      throw new Error("이미지가 data URL이 아닙니다.");
    }
    if (src.includes("tmp/")) {
      throw new Error("이미지 src에 로컬 경로가 남아 있습니다.");
    }
    if (!hasNoExpiredUrl(src)) {
      throw new Error("이미지에 만료 URL이 남아 있습니다.");
    }
  }
  if (/^\s*복사(?:됨!)?\s*$/m.test(markdown)) {
    throw new Error("복사 버튼 문구가 남아 있습니다.");
  }
}

function toTiptapDoc(markdown, markdownToTiptapDoc) {
  const protectedMarkdown = markdown.replace(
    /```([^\n]*)\n([\s\S]*?)\n```/g,
    (_block, language, code) =>
      `\`\`\`${language}\n${code
        .replace(/</g, "%%NOTION_LT%%")
        .replace(/>/g, "%%NOTION_GT%%")}\n\`\`\``
  );
  const doc = markdownToTiptapDoc(protectedMarkdown);
  restoreProtected(doc);
  stripNodeHrefs(doc);
  return doc;
}

function buildRecord(spec, markdownToTiptapDoc) {
  const markdown = buildPageMarkdown(spec, cleanBody(spec));
  const content = JSON.stringify(toTiptapDoc(markdown, markdownToTiptapDoc));
  const stats = documentStats(content);
  assertRecord(spec, markdown, content, stats);
  return {
    spec,
    title: spec.title,
    sourceUrl: stripTracking(spec.sourceUrl),
    content,
    stats,
  };
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

function markersOf(spec, sourceUrl) {
  return [sourceUrl, spec.pageId, spec.hex].filter(Boolean);
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
  // 운영 content ilike는 큰 JSON에서 57014 statement timeout이 난다.
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

async function persist(title, content, markers, extra, libs, sourceUrl) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title,
    content,
    sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markers, libs);
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

function extraOf(spec, record) {
  return {
    key: spec.key,
    pageTitle: record.title,
    images: record.stats.images,
    attachments: record.stats.attachments,
    tables: record.stats.tables,
    codes: record.stats.codes,
  };
}

async function importNotionTarget(spec, markdownToTiptapDoc, checkOnly, libs) {
  const record = buildRecord(spec, markdownToTiptapDoc);
  const extra = extraOf(spec, record);
  if (checkOnly) return extra;
  return persist(
    record.title,
    record.content,
    markersOf(spec, record.sourceUrl),
    extra,
    libs,
    record.sourceUrl
  );
}

async function importWebTarget(spec, markdownToTiptapDoc, checkOnly, libs) {
  const sourceUrl = stripTracking(spec.sourceUrl);
  const html = protectPreBlocks(await fetchText(sourceUrl));
  const $ = cheerio.load(html);
  const contentEl = selectBlogContent($);
  if (spec.images > 0) {
    await inlineBodyImages($, contentEl, sourceUrl);
  }
  await inlineAttachments($, contentEl, sourceUrl);
  const parsed = parseBlogContent($, contentEl, spec);
  const content = JSON.stringify(
    toTiptapDoc(parsed.markdown, markdownToTiptapDoc)
  );
  const stats = documentStats(content);
  assertRecord(spec, parsed.markdown, content, stats);
  const extra = extraOf(spec, { title: parsed.title, stats });
  if (checkOnly) return extra;
  return persist(
    parsed.title,
    content,
    markersOf(spec, sourceUrl),
    extra,
    libs,
    sourceUrl
  );
}

async function importTarget(spec, markdownToTiptapDoc, checkOnly, libs) {
  if (spec.kind === "web") {
    return importWebTarget(spec, markdownToTiptapDoc, checkOnly, libs);
  }
  return importNotionTarget(spec, markdownToTiptapDoc, checkOnly, libs);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const results = [];
  for (const target of TARGETS) {
    results.push(
      await importTarget(target, libs.markdownToTiptapDoc, checkOnly, libs)
    );
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
