// 네이버 블로그 코닥 필름 프롬프트를 Pages에만 저장한다
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
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOG_NO = "224387395142";
const FETCH_URL =
  "https://blog.naver.com/PostView.naver?blogId=ai_newceo&logNo=224387395142";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const KODAK_PROMPT_START =
  "Edit the uploaded photo while preserving the original image exactly.";
const KODAK_PROMPT_END = "exact original photo.";

export const SOURCE_URL = "https://blog.naver.com/ai_newceo/224387395142";
export const PAGE_TITLE = "“이거 누가 찍어줬어?” 소리 듣는 코닥 필름 감성 📸";
export const SKIP_IMAGE_RE =
  /blogpfthumb|se-sticker|storep-phinf|blog_Icon|ssl\.pstatic\.net\/static\/blog|cafe_001|type=pa100/i;
export const REQUIRED_PHRASES = [
  "[사용 방법]",
  "[코닥 필름 만능 프롬프트]",
  "Edit the uploaded photo while preserving the original image exactly.",
  "https://www.instagram.com/ai_newpd/",
  "밝고 자연스럽게 찍힌 여행 스냅",
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

export function originalNaverImageUrl(url) {
  const parsed = new URL(url);
  parsed.protocol = "https:";
  if (
    /mblogthumb-phinf|mblogthumb|blogthumb|postfiles|blogfiles/i.test(
      parsed.hostname
    )
  ) {
    parsed.hostname = "blogfiles.pstatic.net";
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.href;
}

export function wrapKodakPrompt(markdown) {
  const start = markdown.indexOf(KODAK_PROMPT_START);
  if (start < 0) return markdown;
  const end = markdown.indexOf(KODAK_PROMPT_END, start);
  if (end < 0) return markdown;
  const after = end + KODAK_PROMPT_END.length;
  const body = markdown.slice(start, after);
  const before = markdown.slice(0, start);
  const fenceStart = before.lastIndexOf("```");
  if (fenceStart >= 0) {
    const between = markdown.slice(fenceStart + 3, start);
    if (!between.includes("```")) return markdown;
  }
  return `${before}\`\`\`\n${body}\n\`\`\`${markdown.slice(after)}`;
}

function stripTrackingUrl(url) {
  if (/instagram\.com\/ai_newpd/i.test(url)) {
    return "https://www.instagram.com/ai_newpd/";
  }
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("fbclid");
    parsed.searchParams.delete("proxyReferer");
    parsed.searchParams.delete("trackingCode");
    return parsed.href;
  } catch {
    return url.replace(/[?&](?:fbclid|proxyReferer|trackingCode)=[^&\s)]*/g, "");
  }
}

export function cleanArticleMarkdown(markdown) {
  return markdown
    .replace(/\u200B/g, "")
    .replace(/\\([\[\]])/g, "$1")
    .replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, stripTrackingUrl)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPageMarkdown(articleMarkdown) {
  return [`# ${PAGE_TITLE}`, `> 원문. [네이버 블로그](${SOURCE_URL})`, articleMarkdown].join(
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
    headers: { "user-agent": BROWSER_UA, referer: "https://blog.naver.com/" },
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
    $(image).attr("data-lazy-src") ||
    $(image).attr("src") ||
    ""
  ).trim();
}

function assertIntegrity(markdown, content) {
  if (!markdown.includes(`# ${PAGE_TITLE}`) || !content.includes(PAGE_TITLE)) {
    throw new Error("페이지 제목이 없습니다.");
  }
  if (!markdown.includes(SOURCE_URL) || !content.includes(SOURCE_URL)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  const fences = [...markdown.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)].map(
    (match) => match[1].trim()
  );
  if (
    !fences.some(
      (body) =>
        body.startsWith("Edit the uploaded photo") &&
        body.endsWith("exact original photo.")
    )
  ) {
    throw new Error("영문 프롬프트가 코드 펜스 안에 없습니다.");
  }
  const extractPageMediaReferences = loadExtractPageMediaReferences();
  const media = extractPageMediaReferences(content);
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  if (media.imageSources.length !== 7) {
    throw new Error(`본문 이미지가 7장이 아닙니다. ${media.imageSources.length}`);
  }
  for (const forbidden of [
    "w80_blur",
    "fbclid",
    "proxyReferer",
    "trackingCode",
    "m.blog.naver.com/PostView",
  ]) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  if (SKIP_IMAGE_RE.test(markdown) || SKIP_IMAGE_RE.test(content)) {
    throw new Error("프로필/스티커 URL이 남아 있습니다.");
  }
  return media;
}

async function buildImportedPage() {
  const response = await fetch(FETCH_URL, {
    headers: { "user-agent": BROWSER_UA, referer: "https://blog.naver.com/" },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  const content = $(".se-main-container").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
  content.find("script, style, noscript, form").remove();
  content.find(".se-sticker").remove();

  const imageUrls = [];
  content.find("img").each((_, image) => {
    let imageUrl = imageSrcOf(image, $);
    if (!imageUrl) {
      $(image).remove();
      return;
    }
    try {
      imageUrl = new URL(imageUrl, FETCH_URL).href.replace(/^http:\/\//, "https://");
    } catch {
      $(image).remove();
      return;
    }
    if (isSkipImage(imageUrl)) {
      $(image).remove();
      return;
    }
    imageUrl = originalNaverImageUrl(imageUrl);
    imageUrls.push(imageUrl);
    $(image).attr("src", imageUrl);
    $(image).removeAttr("data-lazy-src");
    $(image).removeAttr("data-src");
    $(image).removeAttr("srcset");
  });

  // 이미지 감싼 링크는 원본 URL이 남지 않게 푼다.
  content.find("a").each((_, link) => {
    const images = $(link).children("img");
    if (images.length === 1) $(link).replaceWith(images);
  });

  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", stripTrackingUrl(href));
  });

  const imageMap = new Map();
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
  const articleMarkdown = wrapKodakPrompt(
    cleanArticleMarkdown(turndown.turndown(content.html() || "").trim())
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

function findLocalPage(db, title) {
  const byTitle = db
    .prepare(
      "SELECT id, title, content FROM custom_pages WHERE user_id = ? AND title = ?"
    )
    .get(LOCAL_USER, title);
  if (byTitle) return { row: byTitle, byTitle: true };
  const bySource = db
    .prepare(
      `SELECT id, title, content FROM custom_pages
       WHERE user_id = ? AND (content LIKE ? OR content LIKE ?)
       LIMIT 1`
    )
    .get(LOCAL_USER, `%${LOG_NO}%`, `%${SOURCE_URL}%`);
  if (bySource) return { row: bySource, byTitle: false };
  return { row: null, byTitle: false };
}

function importLocal(page) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const found = findLocalPage(db, page.title);
  if (found.row && found.byTitle && found.row.content === page.content) {
    result.pageSkips += 1;
    result.pageId = found.row.id;
  } else if (found.row && found.byTitle) {
    db.prepare(
      "UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
    ).run(page.content, page.updated_at, found.row.id, LOCAL_USER);
    result.pageUpdates += 1;
    result.pageId = found.row.id;
  } else if (found.row) {
    // 제목이 다른 원문 중복은 덮어쓰지 않는다.
    result.pageSkips += 1;
    result.pageId = found.row.id;
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
    result.pages += 1;
  }
  db.close();
  return result;
}

async function findProductionPage(supabase, title) {
  // 운영 본문 LIKE는 대용량 행 스캔으로 timeout이 나서 제목으로만 찾는다.
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title, content")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return { row: data[0], byTitle: true };
  return { row: null, byTitle: false };
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
  const found = await findProductionPage(supabase, page.title);
  if (found.row && found.byTitle && found.row.content === page.content) {
    result.pageSkips += 1;
    result.pageId = found.row.id;
    return result;
  }
  if (found.row && found.byTitle) {
    const { error: updateError } = await supabase
      .from("custom_pages")
      .update({ content: page.content, updated_at: page.updated_at })
      .eq("id", found.row.id)
      .eq("user_id", PROD_USER);
    if (updateError) throw updateError;
    result.pageUpdates += 1;
    result.pageId = found.row.id;
    return result;
  }
  if (found.row) {
    result.pageSkips += 1;
    result.pageId = found.row.id;
    return result;
  }
  // 대용량 본문은 직접 INSERT하면 statement timeout이 나서 짧은 행을 만든 뒤 갱신한다.
  const stub = JSON.stringify({ type: "doc", content: [] });
  const { error: insertError } = await supabase.from("custom_pages").insert({
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: stub,
    created_at: page.created_at,
    updated_at: page.updated_at,
  });
  if (insertError) throw insertError;
  const { error: fillError } = await supabase
    .from("custom_pages")
    .update({ content: page.content, updated_at: page.updated_at })
    .eq("id", page.id)
    .eq("user_id", PROD_USER);
  if (fillError) throw fillError;
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
