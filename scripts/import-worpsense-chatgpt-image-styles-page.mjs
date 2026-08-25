// 워프센스 ChatGPT 이미지 프롬프트 20가지 글을 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LOCAL_USER = "dev";
export const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const SOURCE_URL =
  "https://worpsense.com/chatgpt-%EC%9D%B4%EB%AF%B8%EC%A7%80-%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-20%EA%B0%80%EC%A7%80-ai-%EC%9D%B4%EB%AF%B8%EC%A7%80-%EC%8A%A4%ED%83%80%EC%9D%BC-%ED%95%9C-%EB%B2%88%EC%97%90-%EB%B0%94/";
export const FETCH_URL = SOURCE_URL;
export const PAGE_TITLE =
  "ChatGPT 이미지 프롬프트 20가지, AI 이미지 스타일 한 번에 바꾸는 방법";
export const SKIP_IMAGE_RE =
  /logo|gravatar|merlin|뉴스레터|HE00\d|300x158|shapes\//i;
export const REQUIRED_PHRASES = [
  "/exploded",
  "/blueprint",
  "/agingeffect",
  "미러리스 카메라를 exploded view",
  "대상 + 표현 방식 + 구도",
  "빨간색 클래식 자동차를 blueprint",
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
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

export function isSkipImage(url) {
  if (!url) return true;
  const candidates = [url];
  try {
    candidates.push(decodeURI(url));
  } catch {
    // 잘못된 퍼센트 인코딩은 원문 URL만 검사한다.
  }
  return candidates.some((value) => SKIP_IMAGE_RE.test(value));
}

function stripTracking(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url, SOURCE_URL);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key === "fbclid" || key.startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return url
      .replace(/[?&](?:utm_[^=&#]*|fbclid)=[^&\s)#]*/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

export function cleanArticleMarkdown(markdown) {
  return markdown
    .replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url))
    .replace(/[?&](?:utm_[^=&#]*|fbclid)=[^&\s)#]*/g, "")
    .replace(/fbclid/g, "")
    .replace(/\[[^\]]*\]\([^)]*\/merlin\/[^)]*\)/g, "")
    .replace(/##### 워프센스 뉴스레터 구독하기[\s\S]*?(?=\n#{1,6} )/m, "")
    .replace(/구독하기[\s\S]*?구독은 언제든지 해지할 수 있습니다\.\s*/g, "")
    .replace(/\[[^\]]*요약하기\]\([^)]+\)/g, "")
    .replace(/❤️?\s*좋아요\s*\d+/g, "")
    .replace(/### 댓글을 남겨주세요[\s\S]*/m, "")
    .replace(/## 최신 글[\s\S]*/m, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildPageMarkdown(articleMarkdown) {
  return [`# ${PAGE_TITLE}`, `> 원문. [Worpsense](${SOURCE_URL})`, articleMarkdown].join(
    "\n\n"
  );
}

function imageMime(bytes, header) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/))
    return "image/gif";
  if (Buffer.from(bytes.subarray(0, 12)).toString("ascii").match(/^RIFF....WEBP$/))
    return "image/webp";
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 형식을 판별하지 못했습니다.");
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", referer: FETCH_URL },
  });
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
}

function loadMarkdownToTiptap() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  return markdownToTiptapDoc;
}

function loadExtractPageMediaReferences() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { extractPageMediaReferences } = require(
    resolve(root, "src/lib/page-attachment-storage.ts")
  );
  return extractPageMediaReferences;
}

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
}

function prependHeroImage($, content) {
  const featured = $(
    ".elementor-widget-theme-post-featured-image img, img.wp-post-image"
  ).first();
  if (!featured.length) return;
  let featuredUrl = imageSrcOf(featured, $);
  if (!featuredUrl) return;
  featuredUrl = stripTracking(
    new URL(featuredUrl, FETCH_URL).href.replace(/^http:\/\//, "https://")
  );
  if (isSkipImage(featuredUrl)) return;
  const already = content.find("img").toArray().some((image) => {
    const src = imageSrcOf(image, $);
    return (
      src &&
      stripTracking(new URL(src, FETCH_URL).href.replace(/^http:\/\//, "https://")) ===
        featuredUrl
    );
  });
  if (already) return;
  const alt = featured.attr("alt") || PAGE_TITLE;
  content.prepend($("<p>").append($("<img>").attr("src", featuredUrl).attr("alt", alt)));
}

export function assertIntegrity(markdown, content) {
  if (!markdown.includes(`# ${PAGE_TITLE}`) || !content.includes(PAGE_TITLE)) {
    throw new Error("페이지 제목이 없습니다.");
  }
  if (!markdown.includes(SOURCE_URL) || !content.includes(SOURCE_URL)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  const extractPageMediaReferences = loadExtractPageMediaReferences();
  const media = extractPageMediaReferences(content);
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  if (media.imageSources.length < 5) {
    throw new Error(`본문 이미지가 부족합니다. ${media.imageSources.length}`);
  }
  for (const forbidden of ["merlin_banner", "동의하고 구독", "fbclid", "gravatar"]) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  return media;
}

async function buildImportedPage() {
  const response = await fetch(FETCH_URL, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  let content = $(".elementor-widget-theme-post-content").first();
  if (!content.length) {
    content = $("article .entry-content, .entry-content, article").first();
  }
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
  prependHeroImage($, content);
  content.find("script, style, noscript, form").remove();
  content.find("a[href*='/merlin/']").each((_, link) => {
    const wrap = $(link).closest("figure, p, .wps-merlin-banner");
    if (wrap.length) wrap.remove();
    else $(link).remove();
  });
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", stripTracking(href));
  });

  const imageMap = new Map();
  const imageUrls = [];
  content.find("img").each((_, image) => {
    let imageUrl = imageSrcOf(image, $);
    if (!imageUrl) return;
    imageUrl = stripTracking(
      new URL(imageUrl, FETCH_URL).href.replace(/^http:\/\//, "https://")
    );
    if (isSkipImage(imageUrl)) {
      $(image).remove();
      return;
    }
    imageUrls.push(imageUrl);
    $(image).attr("src", imageUrl);
  });

  for (const url of [...new Set(imageUrls)]) {
    imageMap.set(url, await downloadImage(url));
  }
  content.find("img").each((_, image) => {
    const src = $(image).attr("src");
    if (src && imageMap.has(src)) $(image).attr("src", imageMap.get(src));
  });

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  const articleMarkdown = cleanArticleMarkdown(
    turndown.turndown(content.html() || "").trim()
  );
  const markdown = buildPageMarkdown(articleMarkdown);
  const pageContent = JSON.stringify(loadMarkdownToTiptap()(markdown));
  const media = assertIntegrity(markdown, pageContent);
  return { markdown, content: pageContent, images: media.imageSources.length };
}

function pageAction(result) {
  if (result.pages) return "insert";
  if (result.pageUpdates) return "update";
  return "skip";
}

function isTimeoutError(error) {
  const message = String(error?.message ?? error ?? "");
  const code = String(error?.code ?? error?.cause?.code ?? "");
  return /timeout|57014|canceling statement/i.test(`${message} ${code}`);
}

function findLocalPage(db, title) {
  const byTitle = db
    .prepare("SELECT id FROM custom_pages WHERE user_id = ? AND title = ?")
    .get(LOCAL_USER, title);
  if (byTitle) return byTitle;
  const bySource = db
    .prepare(
      `SELECT id FROM custom_pages
       WHERE user_id = ? AND content LIKE ?
       LIMIT 1`
    )
    .get(LOCAL_USER, `%${SOURCE_URL}%`);
  return bySource ?? null;
}

function importLocal(page) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    db.close();
    return result;
  }
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
  result.pages += 1;
  db.close();
  return result;
}

async function findProductionPage(supabase, title) {
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return data[0];

  try {
    const { data: bySource, error: sourceError } = await supabase
      .from("custom_pages")
      .select("id")
      .eq("user_id", PROD_USER)
      .ilike("content", `%${SOURCE_URL}%`)
      .limit(1);
    if (sourceError) {
      if (isTimeoutError(sourceError)) return null;
      throw sourceError;
    }
    return bySource?.[0] ?? null;
  } catch (caught) {
    if (isTimeoutError(caught)) return null;
    throw caught;
  }
}

async function importProduction(page) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page.title);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    return result;
  }
  const { error: insertError } = await supabase.from("custom_pages").insert({
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    created_at: page.created_at,
    updated_at: page.updated_at,
  });
  if (insertError) throw insertError;
  result.pages += 1;
  return result;
}

async function main() {
  const imported = await buildImportedPage();
  if (process.argv.includes("--check")) {
    console.log(
      JSON.stringify(
        {
          pageTitle: PAGE_TITLE,
          markdownLength: imported.markdown.length,
          images: imported.images,
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
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record);
  record.id = local.pageId;
  const production = await importProduction(record);
  const pageId = production.pageId || local.pageId;
  console.log(
    JSON.stringify(
      {
        local: {
          action: pageAction(local),
          pages: local.pages,
          pageUpdates: local.pageUpdates,
          pageSkips: local.pageSkips,
        },
        production: {
          action: pageAction(production),
          pages: production.pages,
          pageUpdates: production.pageUpdates,
          pageSkips: production.pageSkips,
        },
        pageId,
        path: `/pages/${pageId}`,
        images: imported.images,
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
