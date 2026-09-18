// 짐코딩 앤트로픽 엔지니어 클로드 업무 활용법 가이드를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { documentStats } from "./import-claude-eli5-page.mjs";
import {
  cleanGymMarkdown,
  extractGymAccordions,
  fillFaqAnswers,
  isSkipImage,
  stripTracking,
} from "./import-gymcoding-articles.mjs";

export {
  cleanGymMarkdown,
  extractGymAccordions,
  fillFaqAnswers,
  isSkipImage,
  stripTracking,
} from "./import-gymcoding-articles.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_ORIGIN = "https://www.gymcoding.co";

export const SOURCE_URL =
  "https://www.gymcoding.co/articles/anthropic-engineer-claude-workflow-guide";
export const PAGE_TITLE =
  "클로드 업무 활용법 5가지: 앤트로픽 엔지니어의 프롬프트·코드 실습";
export const YOUTUBE_URL = "https://www.youtube.com/watch?v=qqrk7CtkuIw";
export const YOUTUBE_THUMB = "https://i.ytimg.com/vi/qqrk7CtkuIw/hqdefault.jpg";
export const EXPECTED_IMAGES = 2;
export const EXPECTED_ATTACHMENTS = 0;

const OG_IMAGE_URL = `${SOURCE_URL}/opengraph-image-1ya3q7?052be9e71b4cd640`;
const REQUIRED_PHRASES = [
  "이런 분을 위한 글입니다",
  "마이크 크리거",
  "content_metrics.json",
  "analyze_content.cjs",
  "CLAUDE.md",
  "목표만 말하면 클로드가 알아서 끝내주나요?",
];
const REQUIRED_HREFS = [
  SOURCE_URL,
  YOUTUBE_URL,
  "https://code.claude.com/docs/en/best-practices",
  "https://code.claude.com/docs/en/memory",
  "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects",
];
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "utm_source",
];
const FORBIDDEN = [
  "fbclid",
  "짐코딩 뉴스레터",
  "동의하고 구독",
  "inf.run",
  "인프런에서 수강하기",
  "/logo.svg",
  "opengraph-image",
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

/** 만료 URL 문자열이 본문에 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

/** 제목 또는 원문 주소가 같으면 중복이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const source = stripTracking(row.source_url || "");
  if (
    markers.some(
      (marker) => marker && (row.source_url === marker || source === marker)
    )
  ) {
    return true;
  }
  return false;
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

function toAbsoluteUrl(url) {
  if (!url) return url;
  if (/^(https?:|data:|mailto:)/i.test(url)) return stripTracking(url);
  try {
    return stripTracking(new URL(url, SITE_ORIGIN).href);
  } catch {
    return stripTracking(url);
  }
}

function metaContent($, property) {
  return (
    $(`meta[property="${property}"]`).attr("content") ||
    $(`meta[name="${property}"]`).attr("content") ||
    ""
  ).trim();
}

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
}

function unwrapGymHeadings($, content) {
  content.find("h3[data-accordion-value]").each((_, el) => {
    const question = $(el).attr("data-accordion-value") || $(el).text().trim();
    $(el).replaceWith($("<h3>").text(question));
  });
  content.find("[role='region'][hidden], [role='region'][data-state='closed']").remove();
  content.find("h1, h2, h3, h4, h5, h6").each((_, heading) => {
    const node = $(heading);
    const anchor = node.find("a[href^='#']").first();
    if (!anchor.length) return;
    const text = anchor.text().trim();
    if (!text) return;
    node.empty();
    node.text(text);
  });
}

function removeGymPromo($, content) {
  content.find("script, style, noscript, form, ins, video, button.cpy").remove();
  content.find("a[href*='inf.run'], a[href*='inflearn']").each((_, link) => {
    const wrap = $(link).closest("[data-slot='card']");
    if (wrap.length) wrap.remove();
    else $(link).remove();
  });
  content.find("[data-slot='card']").each((_, el) => {
    const text = $(el).text();
    if (text.includes("짐코딩 뉴스레터")) {
      $(el).remove();
      return;
    }
    if (text.includes("인프런") && text.includes("클로드 코드 완벽 마스터")) {
      $(el).remove();
    }
  });
}

/** 유튜브 라이트 임베드를 썸네일 링크로 바꾼다. */
export function convertYtLite($, content) {
  content.find(".yt-lite").each((_, el) => {
    $(el).replaceWith(
      $(
        `<p><a href="${YOUTUBE_URL}"><img src="${YOUTUBE_THUMB}" alt="유튜브 영상"></a></p>`
      )
    );
  });
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

function imageMime(bytes, header) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/)) {
    return "image/gif";
  }
  if (Buffer.from(bytes.subarray(0, 12)).toString("ascii").match(/^RIFF....WEBP$/)) {
    return "image/webp";
  }
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 형식을 판별하지 못했습니다.");
}

function imageCandidates(url) {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  push(url);
  try {
    const parsed = new URL(url);
    if (parsed.search) {
      parsed.search = "";
      push(parsed.href);
    }
  } catch {
    // URL 파싱 실패 시 원문만 쓴다.
  }
  if (/opengraph-image/i.test(String(url))) {
    push(`${SITE_ORIGIN}/opengraph-image`);
  }
  return out;
}

async function downloadImage(url, referer) {
  let lastError = new Error(`이미지를 받지 못했습니다. ${url}`);
  for (const candidate of imageCandidates(url)) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(candidate, {
          headers: { "user-agent": "Mozilla/5.0", referer: referer || candidate },
        });
        if (response.ok) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          return `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
        }
        lastError = new Error(`이미지 HTTP ${response.status}: ${candidate}`);
        if (response.status < 500 && response.status !== 429) break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
      await pause(400 * (attempt + 1));
    }
  }
  throw lastError;
}

async function inlineBodyImages($, content, sourceUrl) {
  const images = [...content.find("img").toArray()];
  for (const image of images) {
    let imageUrl = imageSrcOf(image, $);
    if (!imageUrl) {
      $(image).remove();
      continue;
    }
    imageUrl = new URL(imageUrl, sourceUrl).href.replace(/^http:\/\//, "https://");
    if (isSkipImage(imageUrl)) {
      $(image).remove();
      continue;
    }
    try {
      const dataUrl = await downloadImage(imageUrl, sourceUrl);
      $(image).attr("src", dataUrl);
      $(image).removeAttr("srcset");
      $(image).removeAttr("data-src");
      $(image).removeAttr("data-lazy-src");
    } catch (error) {
      console.error(`본문 이미지 생략 ${imageUrl}. ${error.message || error}`);
      $(image).remove();
    }
  }
}

function keepYoutubeMarkdown(markdown) {
  let text = String(markdown ?? "");
  text = text.replace(
    /\[(!\[[^\]]*\]\([^)]+\))\]\((https:\/\/(?:www\.)?youtube\.com\/watch\?v=qqrk7CtkuIw)\)/g,
    `$1\n\n[유튜브 영상](${YOUTUBE_URL})`
  );
  if (!text.includes(YOUTUBE_URL)) {
    text = text.replace(
      /(!\[유튜브 영상\]\([^)]+\))/,
      `$1\n\n[유튜브 영상](${YOUTUBE_URL})`
    );
  }
  return text;
}

function buildPageMarkdown(articleMarkdown, coverDataUrl) {
  return [
    `# ${PAGE_TITLE}`,
    `> 원문. [짐코딩](${SOURCE_URL})`,
    `![표지](${coverDataUrl})`,
    articleMarkdown,
  ]
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function assertFaqAnswers(markdown) {
  const section = String(markdown ?? "").split("## 자주 묻는 질문")[1];
  if (!section) throw new Error("FAQ 절이 없습니다.");
  const parts = section.split(/^### /m).slice(1);
  if (!parts.length) throw new Error("FAQ 질문이 없습니다.");
  for (const part of parts) {
    const answer = part.replace(/^[^\n]+\n*/, "").split(/^## /m)[0].trim();
    if (!answer) throw new Error("FAQ 답이 비어 있습니다.");
  }
}

function assertIntegrity(markdown, content, stats, media) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(SOURCE_URL) || !content.includes(SOURCE_URL)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== EXPECTED_IMAGES || media.imageSources.length !== EXPECTED_IMAGES) {
    throw new Error(`본문 이미지가 ${EXPECTED_IMAGES}장이 아닙니다. ${stats.images}`);
  }
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`첨부가 ${EXPECTED_ATTACHMENTS}개가 아닙니다. ${stats.attachments}`);
  }
  for (const href of REQUIRED_HREFS) {
    if (!stats.hrefs.includes(href)) {
      throw new Error(`TipTap 링크가 없습니다. ${href}`);
    }
  }
  for (const forbidden of FORBIDDEN) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  assertFaqAnswers(markdown);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

async function buildImportedPage(libs) {
  const html = await fetchText(SOURCE_URL);
  const $ = cheerio.load(html);
  const content = $("article.py-page-y").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");

  const ogImage = stripTracking(metaContent($, "og:image")) || OG_IMAGE_URL;
  content.find("header h1").remove();
  unwrapGymHeadings($, content);
  removeGymPromo($, content);
  convertYtLite($, content);
  content.find("button, svg").remove();
  await inlineBodyImages($, content, SOURCE_URL);
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", toAbsoluteUrl(href));
  });

  const coverDataUrl = await downloadImage(ogImage, SOURCE_URL);
  const faqs = extractGymAccordions(html);
  const articleMarkdown = fillFaqAnswers(
    keepYoutubeMarkdown(
      cleanGymMarkdown(createTurndown().turndown(content.html() || "").trim())
    ),
    faqs
  );
  const markdown = buildPageMarkdown(articleMarkdown, coverDataUrl);
  const pageContent = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(pageContent);
  const media = libs.extractPageMediaReferences(pageContent);
  assertIntegrity(markdown, pageContent, stats, media);
  return {
    markdown,
    content: pageContent,
    images: media.imageSources.length,
    attachments: stats.attachments,
  };
}

function pageAction(result) {
  if (result.pages) return "insert";
  if (result.pageUpdates) return "update";
  return "skip";
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
  const existing = await findProductionPage(supabase, page.title, page.sourceUrl);
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

async function main() {
  const libs = loadLibs();
  const imported = await buildImportedPage(libs);
  if (process.argv.includes("--check")) {
    console.log(
      JSON.stringify(
        {
          pageTitle: PAGE_TITLE,
          markdownLength: imported.markdown.length,
          images: imported.images,
          attachments: imported.attachments,
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
    sourceUrl: SOURCE_URL,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markersOf(), libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
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
        attachments: imported.attachments,
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
