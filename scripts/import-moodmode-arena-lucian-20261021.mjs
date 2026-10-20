// 무드모드 아레나 칼럼과 루샨 클로드코드 꿀팁 글을 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { documentStats, imageMime } from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const TRACKING_KEY = ["fb", "clid"].join("");
const ZWSP = "\u200b";

export const MOOD_URL =
  "https://moodmode.ai/column/claude-arena-100-agent-tournament";
export const MOOD_TITLE = "클로드 100명 토너먼트 가이드";
export const LUCIAN_URL = "https://x.com/lucian__03/status/2111802461149364647";
export const LUCIAN_TITLE =
  "🔥 모든 클로드코드 꿀팁 총정리 🔥 (진짜 🍯 꿀팁만 담았습니다.) (2026년 10월기준)";
export const REVERSE_URL = "https://shimteamjjang.vercel.app/reverse";
export const REVERSE_TITLE = "앱을 AI가 뜯어서 다시 만들어 주는 무료 도구";
export const TOP_SKILLS_URL =
  "https://every-ai-guides.vercel.app/posts/claude-code-top-skills-5";
export const TOP_SKILLS_TITLE =
  "처음이라면 무조건 클로드 코드 최고의 스킬 5개 설치 가이드";

export const MOOD_EXPECTED = { images: 10, attachments: 0, tables: 0, codes: 3 };
export const LUCIAN_EXPECTED = { images: 22, attachments: 0, tables: 0, codes: 4 };

export const MOOD_HREFS = [
  MOOD_URL,
  "https://github.com/Jakeschincariol/arena-skill",
  "https://www.instagram.com/moodmode.ai",
];
export const LUCIAN_HREFS = [
  LUCIAN_URL,
  "https://x.com/lucian__03",
  "https://x.com/lucian__03/status/2081761475560157477",
  "https://x.com/lucian__03/status/2103173166973718537",
  "https://x.com/lucian__03/status/2103173295118098750",
  "https://x.com/lucian__03/status/2103173396075065594",
  "https://x.com/lucian__03/status/2103173518573916178",
  "https://x.com/lucian__03/status/2103173612832444536",
  "https://x.com/lucian__03/status/2103173754218258607",
  "https://x.com/lucian__03/status/2104560017407869028",
  "https://x.com/lucian__03/status/2104641991279874134",
  "https://x.com/lucian__03/status/2106396357527531800",
  "https://x.com/lucian__03/status/2108194703782916166",
  "https://x.com/lucian__03/status/2108589402914177236",
  "https://x.com/lucian__03/status/2108997241864159442",
];

const MOOD_PHRASES = [
  "2026년 10월 20일",
  "클로드 100명에게 같은 일을 시키고",
  "STEP 1. 설치",
  "흑임자구름",
  "https://github.com/Jakeschincariol/arena-skill 이 스킬 설치해줘",
  "/arena --quick 동네 카페 신메뉴",
  "/arena 투자 제안서 첫 페이지 다듬어줘",
];
const LUCIAN_PHRASES = [
  "1. 서브에이전트마다 Effort를 다르게 설정하기",
  "1. 파일 위치 찾기와 자료 정리는 low effort로",
  "10. 꼭 지켜야 할 규칙은 Hooks로.",
  "/autocompact 600k",
  "/doctor prompt-audit",
  "npx claude-mem install",
  "claude --worktree feature-auth",
  "v2.1.302",
  "세션 ID로 실수 분석시키기",
];
const MOOD_FORBIDDEN = [
  "칼럼 목록",
  "다음에 읽을 글",
  "AEO 서비스 살펴보기",
  "무드모드 AI 라운지",
  "from=column",
  "column-media/",
  TRACKING_KEY,
  "utm_source",
];
const LUCIAN_FORBIDDEN = [
  "pbs.twimg.com",
  "api.fxtwitter.com",
  TRACKING_KEY,
  "utm_source",
  "?s=",
  "prod-files-secure",
  "X-Amz",
  "file.notion.so",
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
      (value === "dm" || value === "guide" || value === "littly" || value === "column")) ||
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
    if (
      parsed.protocol === "http:" &&
      host !== "localhost" &&
      host !== "127.0.0.1"
    ) {
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

function guardOrdered(line) {
  if (/^\d+\.\s+/.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
    return `${ZWSP}${line}`;
  }
  return line;
}

function plainText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function imageMarkdown(alt, dataUrl) {
  const safeAlt = String(alt ?? "")
    .replace(/[\]\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!String(dataUrl).startsWith("data:image/")) {
    throw new Error("본문 이미지가 data URL이 아닙니다.");
  }
  return `![${safeAlt}](${dataUrl})`;
}

/** 이미지 바이트를 data URL로 바꾼다. */
export function imageDataUrl(bytes, header) {
  const mime = imageMime(bytes, header);
  if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime)) {
    throw new Error("본문 이미지 MIME이 허용되지 않습니다.");
  }
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function absoluteUrl(url, base) {
  return stripTracking(url, base);
}

/** 무드모드 칼럼 HTML을 저장용 마크다운으로 바꾼다. */
export function moodMarkdownFromHtml(html, resolveImage) {
  const $ = cheerio.load(html);
  const header = $("h1").first().closest("header");
  const title = plainText($("h1").first().text());
  if (title !== MOOD_TITLE) throw new Error("무드모드 제목이 다릅니다.");
  const meta = header
    .find("p.t-small span")
    .toArray()
    .map((element) => plainText($(element).text()))
    .filter(Boolean)
    .join(" ")
    .replace(/\s*·\s*/g, " · ")
    .replace(/(\d)\s+분/g, "$1분");
  const dek = plainText(header.find("p.t-body").first().text());
  const body = $("#column-markdown").first();
  if (!body.length) throw new Error("칼럼 본문 #column-markdown 을 찾지 못했습니다.");
  body.find("button, script, style, nav").remove();
  const images = [];
  body.find("img").each((_, element) => {
    const node = $(element);
    const src = absoluteUrl(node.attr("src") || "", MOOD_URL);
    const dataUrl = resolveImage(src);
    if (!dataUrl) throw new Error("무드모드 이미지를 받지 못했습니다.");
    const token = `IMGTOKEN${images.length}END`;
    images.push(imageMarkdown(node.attr("alt") || "본문 이미지", dataUrl));
    node.replaceWith(token);
  });
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  let markdown = turndown.turndown(body.html() || "");
  images.forEach((line, index) => {
    markdown = markdown.replaceAll(`IMGTOKEN${index}END`, `\n\n${line}\n\n`);
  });
  markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    return `[${label}](${stripTracking(href, MOOD_URL)})`;
  });
  const sourceLabel = "moodmode.ai/column/claude-arena-100-agent-tournament";
  const head = [
    meta,
    "",
    `# ${title}`,
    "",
    dek,
    "",
    `원본 [${sourceLabel}](${MOOD_URL})`,
    "",
  ].join("\n");
  return `${head}\n${markdown.trim()}\n`.replace(/\n{3,}/g, "\n\n");
}

function entityMapOf(article) {
  const map = new Map();
  for (const entry of article?.content?.entityMap ?? []) {
    map.set(String(entry.key), entry.value);
  }
  return map;
}

function mediaUrlById(article) {
  const map = new Map();
  for (const entity of article?.media_entities ?? []) {
    const url = entity?.media_info?.original_img_url;
    if (!url) throw new Error("X 글 이미지 주소가 없습니다.");
    map.set(String(entity.media_id), url);
  }
  return map;
}

function renderInline(block, entities) {
  const text = block.text || "";
  const bold = Array(text.length).fill(false);
  const link = Array(text.length).fill(null);
  for (const range of block.inlineStyleRanges ?? []) {
    if (range.style !== "Bold") continue;
    for (let index = range.offset; index < range.offset + range.length; index += 1) {
      if (index < text.length) bold[index] = true;
    }
  }
  for (const range of block.entityRanges ?? []) {
    const entity = entities.get(String(range.key));
    if (!entity || entity.type !== "LINK") continue;
    const url = stripTracking(entity.data?.url || "");
    for (let index = range.offset; index < range.offset + range.length; index += 1) {
      if (index < text.length) link[index] = url;
    }
  }
  const urlRe = /https:\/\/[^\s)]+/g;
  for (const match of text.matchAll(urlRe)) {
    const raw = match[0].replace(/[.,]+$/g, "");
    const start = match.index ?? 0;
    const end = start + raw.length;
    if (link.slice(start, end).some(Boolean)) continue;
    const url = stripTracking(raw);
    for (let index = start; index < end; index += 1) link[index] = url;
  }
  let out = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] === "\n") {
      out += "\n";
      index += 1;
      continue;
    }
    const url = link[index];
    const isBold = bold[index];
    let next = index + 1;
    while (
      next < text.length &&
      text[next] !== "\n" &&
      link[next] === url &&
      bold[next] === isBold
    ) {
      next += 1;
    }
    const chunk = text.slice(index, next);
    if (url) out += `[${chunk}](${url})`;
    else if (isBold) out += `**${chunk}**`;
    else out += chunk;
    index = next;
  }
  return out;
}

function codeFence(raw) {
  const text = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  const fenced = /^```[^\n]*\n([\s\S]*?)\n```$/.exec(text);
  const inner = (fenced ? fenced[1] : text).trim();
  if (!inner) throw new Error("X 글 코드 블록이 비어 있습니다.");
  if (inner.includes("```")) throw new Error("X 글 코드 블록 안에 펜스가 있습니다.");
  return `\`\`\`\n${inner}\n\`\`\``;
}

function renderAtomic(block, entities, article, resolveImage) {
  const key = block.entityRanges?.[0]?.key;
  const entity = entities.get(String(key));
  if (!entity) throw new Error("X 글 첨부 블록을 찾지 못했습니다.");
  if (entity.type === "DIVIDER") return "---";
  if (entity.type === "MARKDOWN") return codeFence(entity.data?.markdown);
  if (entity.type === "MEDIA") {
    const mediaId = entity.data?.mediaItems?.[0]?.mediaId;
    const url = mediaUrlById(article).get(String(mediaId));
    if (!url) throw new Error("X 글 본문 이미지 주소를 찾지 못했습니다.");
    return imageMarkdown("본문 이미지", resolveImage(url));
  }
  throw new Error(`다루지 않는 X 글 블록입니다. ${entity.type}`);
}

/** 루샨 X 아티클 JSON을 저장용 마크다운으로 바꾼다. */
export function lucianMarkdownFromArticle(article, resolveImage) {
  if (plainText(article?.title) !== LUCIAN_TITLE) {
    throw new Error("루샨 글 제목이 다릅니다.");
  }
  const entities = entityMapOf(article);
  const coverUrl = article?.cover_media?.media_info?.original_img_url;
  if (!coverUrl) throw new Error("루샨 글 표지 주소가 없습니다.");
  const lines = [
    `# ${LUCIAN_TITLE}`,
    "",
    "루샨 [lucian__03](https://x.com/lucian__03) · 2026-10-18",
    "",
    `원본 [x.com/lucian__03/status/2111802461149364647](${LUCIAN_URL})`,
    "",
    imageMarkdown("표지", resolveImage(coverUrl)),
    "",
  ];
  let listKind = null;
  for (const block of article.content?.blocks ?? []) {
    if (block.type === "atomic") {
      listKind = null;
      lines.push(renderAtomic(block, entities, article, resolveImage));
      lines.push("");
      continue;
    }
    const text = renderInline(block, entities);
    if (block.type === "header-one" || block.type === "header-two") {
      listKind = null;
      const heading = text.replace(/\n/g, " ").trim();
      if (!heading) continue;
      lines.push(`${block.type === "header-one" ? "#" : "##"} ${heading}`);
      lines.push("");
      continue;
    }
    if (block.type === "unordered-list-item" || block.type === "ordered-list-item") {
      if (listKind !== block.type) {
        if (lines.at(-1) !== "") lines.push("");
        listKind = block.type;
      }
      const item = text.replace(/\n/g, " ").replace(/[ \t]{2,}/g, " ").trim();
      if (!item) continue;
      lines.push(block.type === "unordered-list-item" ? `- ${item}` : `1. ${item}`);
      continue;
    }
    listKind = null;
    for (const part of text.split(/\n{2,}/)) {
      const line = guardOrdered(part.replace(/\n/g, " ").replace(/[ \t]{2,}/g, " ").trim());
      if (!line) continue;
      lines.push(line);
      lines.push("");
    }
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function visibleText(value) {
  return String(value ?? "").replace(
    /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi,
    "data:"
  );
}

function assertPage(markdown, content, spec) {
  const plain = visibleText(`${markdown}\n${content}`);
  for (const phrase of spec.phrases) {
    if (!plain.includes(phrase)) throw new Error(`본문 문구가 없습니다. ${phrase}`);
  }
  for (const snippet of spec.forbidden) {
    if (plain.includes(snippet)) throw new Error(`빼야 할 내용이 남았습니다. ${snippet}`);
  }
  const stats = documentStats(content);
  for (const key of ["images", "attachments", "tables", "codes"]) {
    if (stats[key] !== spec.expected[key]) {
      throw new Error(`${key} 개수가 ${stats[key]}입니다. 기대값은 ${spec.expected[key]}입니다.`);
    }
  }
  for (const href of spec.hrefs) {
    if (!stats.hrefs.includes(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
  if (spec.horizontalRule && !content.includes('"horizontalRule"')) {
    throw new Error("구분선이 없습니다.");
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

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", accept: "*/*" },
  });
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    type: response.headers.get("content-type") || "",
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", accept: "text/html,application/json" },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status} ${url}`);
  return response.text();
}

async function cachedImage(url, cache) {
  if (!cache.has(url)) {
    const file = await fetchBytes(url);
    cache.set(url, imageDataUrl(file.bytes, file.type));
  }
  return cache.get(url);
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
  for (const known of [
    { title: REVERSE_TITLE, sourceUrl: REVERSE_URL },
    { title: TOP_SKILLS_TITLE, sourceUrl: TOP_SKILLS_URL },
  ]) {
    const found = await locate(supabase, known.title, known.sourceUrl);
    if (!found.local || !found.prod) {
      throw new Error(`이미 있어야 하는 글이 한쪽에 없습니다. ${known.sourceUrl}`);
    }
    results.push({
      action: "skip",
      title: known.title,
      pageId: found.local.id,
      path: `/pages/${found.local.id}`,
      sourceUrl: known.sourceUrl,
      fetched: false,
    });
  }

  const targets = [
    {
      key: "mood",
      title: MOOD_TITLE,
      sourceUrl: MOOD_URL,
      expected: MOOD_EXPECTED,
      hrefs: MOOD_HREFS,
      phrases: MOOD_PHRASES,
      forbidden: MOOD_FORBIDDEN,
    },
    {
      key: "lucian",
      title: LUCIAN_TITLE,
      sourceUrl: LUCIAN_URL,
      expected: LUCIAN_EXPECTED,
      hrefs: LUCIAN_HREFS,
      phrases: LUCIAN_PHRASES,
      forbidden: LUCIAN_FORBIDDEN,
      horizontalRule: true,
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
    const cache = new Map();
    const resolveImage = (url) => cachedImage(url, cache);
    let markdown;
    if (target.key === "mood") {
      const html = await fetchText(MOOD_URL);
      const urls = [];
      const $ = cheerio.load(html);
      $("#column-markdown img").each((_, element) => {
        urls.push(absoluteUrl($(element).attr("src") || "", MOOD_URL));
      });
      for (const url of urls) {
        if (!url) throw new Error("무드모드 이미지 주소가 없습니다.");
        await resolveImage(url);
      }
      markdown = moodMarkdownFromHtml(html, (url) => {
        const dataUrl = cache.get(url);
        if (!dataUrl) throw new Error("무드모드 이미지를 받지 못했습니다.");
        return dataUrl;
      });
    } else {
      const payload = JSON.parse(
        await fetchText("https://api.fxtwitter.com/lucian__03/status/2111802461149364647")
      );
      const article = payload?.tweet?.article;
      if (!article) throw new Error("루샨 X 아티클을 찾지 못했습니다.");
      const urls = [article.cover_media?.media_info?.original_img_url];
      for (const entity of article.media_entities ?? []) {
        urls.push(entity?.media_info?.original_img_url);
      }
      for (const url of urls) {
        if (!url) throw new Error("루샨 글 이미지 주소가 없습니다.");
        await resolveImage(url);
      }
      markdown = lucianMarkdownFromArticle(article, (url) => {
        const dataUrl = cache.get(url);
        if (!dataUrl) throw new Error("루샨 글 이미지를 받지 못했습니다.");
        return dataUrl;
      });
    }
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

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
