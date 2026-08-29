// 짐코딩 아티클 목록을 Pages에만 저장한다
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
const SITE_ORIGIN = "https://www.gymcoding.co";
const LIST_URL = `${SITE_ORIGIN}/articles`;
const SKIP_IMAGE_RE = /logo\.svg/i;
const FETCH_GAP_MS = 300;
const GYM_PROMO = [
  "짐코딩 뉴스레터",
  "동의하고 구독",
  "privacy#newsletter",
  "인프런",
  "클로드 코드 완벽 마스터",
  "인프런에서 수강하기",
  "inf.run",
];
const FORBIDDEN = [
  "fbclid",
  "동의하고 구독",
  "짐코딩 뉴스레터",
  "인프런",
  "클로드 코드 완벽 마스터",
  "/logo.svg",
  "inf.run",
  "opengraph-image",
];

export const SKIP_URLS = [
  "https://www.gymcoding.co/articles/matt-pocock-ai-skills-install-guide",
  "https://www.gymcoding.co/articles/claude-code-eli5-guide",
  "https://www.gymcoding.co/articles/claude-code-skills-top-10-install-prompts",
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

/** 유입 추적 쿼리를 빼고 절대 https 주소로 바꾼다. */
export function stripTracking(url, base = SITE_ORIGIN) {
  if (!url) return url;
  try {
    const parsed = new URL(url, base);
    if (/(?:^|\.)gymcoding\.co$/i.test(parsed.hostname)) {
      parsed.protocol = "https:";
      if (parsed.hostname === "gymcoding.co") parsed.hostname = "www.gymcoding.co";
    }
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "fbclid") {
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

function toAbsoluteUrl(url) {
  if (!url) return url;
  if (/^(https?:|data:|mailto:)/i.test(url)) return stripTracking(url);
  try {
    return stripTracking(new URL(url, SITE_ORIGIN).href);
  } catch {
    return stripTracking(url);
  }
}

/** 목록 HTML에서 아티클 원문 주소만 고유하게 뽑는다. */
export function listArticleUrlsFromHtml(html) {
  const seen = new Set();
  const urls = [];
  const re = /(?:https:\/\/(?:www\.)?gymcoding\.co)?\/articles\/([A-Za-z0-9-]+)/g;
  let match;
  while ((match = re.exec(String(html ?? "")))) {
    const url = `${SITE_ORIGIN}/articles/${match[1]}`;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function unescapeJsonString(raw) {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return String(raw ?? "")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      )
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

function unescapeJsString(raw) {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    try {
      return JSON.parse(
        `"${String(raw).replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`
      );
    } catch {
      return String(raw ?? "");
    }
  }
}

function reconstructNextFlight(html) {
  const re =
    /self\.__next_f\.push\(\[\s*1\s*,\s*"((?:\\.|[^"\\])*)"\s*\]\)/g;
  let payload = "";
  let match;
  while ((match = re.exec(String(html ?? "")))) {
    payload += unescapeJsString(match[1]);
  }
  return payload;
}

function collectAccordions(text, out, seen) {
  const re =
    /"title"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"children"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = re.exec(String(text ?? "")))) {
    const title = unescapeJsonString(match[1]).trim();
    const children = unescapeJsonString(match[2]).trim();
    if (!title || !children) continue;
    if (title.length > 200) continue;
    if (/self\.__next_f|<\/script>/i.test(children)) continue;
    if (seen.has(title)) continue;
    seen.add(title);
    out.push({ title, children });
  }
}

/** RSC 페이로드에서 FAQ 질문·답 문자열 쌍을 뽑는다. */
export function extractGymAccordions(html) {
  const seen = new Set();
  const out = [];
  const source = String(html ?? "");
  const reconstructed = reconstructNextFlight(source);
  if (reconstructed) collectAccordions(reconstructed, out, seen);
  collectAccordions(source, out, seen);
  collectAccordions(source.replace(/\\"/g, '"'), out, seen);
  return out;
}

function faqQuestion(item) {
  return String(item?.title ?? item?.q ?? "").trim();
}

function faqAnswer(item) {
  return String(item?.children ?? item?.a ?? "").trim();
}

/** 닫힌 FAQ 헤딩 아래에 답을 넣는다. */
export function fillFaqAnswers(markdown, faqs = []) {
  let text = String(markdown ?? "");
  for (const item of faqs) {
    const question = faqQuestion(item);
    const answer = faqAnswer(item);
    if (!question || !answer) continue;
    const heading = `### ${question}`;
    const escaped = question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(### ${escaped})\\n+(?=### |## |$)`);
    if (pattern.test(text)) {
      text = text.replace(pattern, `$1\n\n${answer}\n\n`);
    } else if (text.includes(heading) && !text.includes(answer)) {
      text = text.replace(heading, `${heading}\n\n${answer}`);
    }
  }
  return text;
}

function filterPromoBlocks(markdown) {
  return markdown
    .split(/\n{2,}/)
    .filter((block) => !GYM_PROMO.some((needle) => block.includes(needle)))
    .join("\n\n");
}

/** 뉴스레터·추적 쿼리·상대 링크를 본문에서 걷어낸다. */
export function cleanGymMarkdown(markdown) {
  let text = String(markdown ?? "")
    .replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${toAbsoluteUrl(path)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url));
  text = filterPromoBlocks(text);
  text = text.replace(/http:\/\/(?:www\.)?gymcoding\.co/g, SITE_ORIGIN);
  text = text.replace(/[?&](?:utm_[^=&#]*|fbclid)=[^&\s)#]*/g, "");
  text = text.replace(/fbclid/g, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
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

function metaContent($, property) {
  return (
    $(`meta[property="${property}"]`).attr("content") ||
    $(`meta[name="${property}"]`).attr("content") ||
    ""
  ).trim();
}

function buildPageMarkdown(title, sourceUrl, articleMarkdown, coverDataUrl) {
  return [
    `# ${title}`,
    `> 원문. [짐코딩](${sourceUrl})`,
    `![표지](${coverDataUrl})`,
    articleMarkdown,
  ].join("\n\n");
}

export function assertIntegrity(markdown, content, spec) {
  const title = spec.title;
  const sourceUrl = spec.sourceUrl;
  if (!markdown.includes(`# ${title}`) || !content.includes(title)) {
    throw new Error("페이지 제목이 없습니다.");
  }
  if (!markdown.includes(sourceUrl) || !content.includes(sourceUrl)) {
    throw new Error("원문 주소가 없습니다.");
  }
  const phrase = String(spec.description || "").trim().slice(0, 20);
  const h1 = String(spec.h1 || title).trim();
  const hasPhrase = Boolean(phrase) && markdown.includes(phrase);
  const hasHeading = Boolean(h1) && markdown.includes(h1);
  if (!hasPhrase && !hasHeading) {
    throw new Error("본문에 한글 확인 문구가 없습니다.");
  }
  if (/http:\/\/(?:www\.)?gymcoding\.co/i.test(markdown) || /http:\/\/(?:www\.)?gymcoding\.co/i.test(content)) {
    throw new Error("짐코딩 주소가 http 로 남아 있습니다.");
  }
  for (const forbidden of FORBIDDEN) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  const extractPageMediaReferences = spec.extractPageMediaReferences;
  const media = extractPageMediaReferences(content);
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  if (media.imageSources.length < 1) {
    throw new Error(`본문 이미지가 부족합니다. ${media.imageSources.length}`);
  }
  return media;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
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

export async function buildImportedPage(sourceUrl, libs) {
  const html = await fetchText(sourceUrl);
  const $ = cheerio.load(html);
  const content = $("article.py-page-y").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");

  const ogTitle = metaContent($, "og:title");
  const ogDescription = metaContent($, "og:description");
  const ogUrl = stripTracking(metaContent($, "og:url") || sourceUrl);
  const ogImage = stripTracking(metaContent($, "og:image"));
  const h1 = content.find("header h1").first().text().trim() || $("h1").first().text().trim();
  const title = ogTitle || h1;
  if (!title) throw new Error("제목을 찾지 못했습니다.");
  if (!ogImage) throw new Error("og:image가 없습니다.");

  content.find("header h1").remove();
  unwrapGymHeadings($, content);
  removeGymPromo($, content);
  content.find("button, svg").remove();
  await inlineBodyImages($, content, ogUrl);
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", toAbsoluteUrl(href));
  });

  const coverDataUrl = await downloadImage(ogImage, ogUrl);
  const faqs = extractGymAccordions(html);
  const articleMarkdown = fillFaqAnswers(
    cleanGymMarkdown(createTurndown().turndown(content.html() || "").trim()),
    faqs
  );
  const markdown = buildPageMarkdown(title, ogUrl, articleMarkdown, coverDataUrl);
  const pageContent = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const media = assertIntegrity(markdown, pageContent, {
    title,
    sourceUrl: ogUrl,
    description: ogDescription,
    h1,
    extractPageMediaReferences: libs.extractPageMediaReferences,
  });
  return {
    title,
    sourceUrl: ogUrl,
    markdown,
    content: pageContent,
    images: media.imageSources.length,
  };
}

function isTimeoutError(error) {
  const message = String(error?.message ?? error ?? "");
  const code = String(error?.code ?? error?.cause?.code ?? "");
  return /timeout|57014|canceling statement/i.test(`${message} ${code}`);
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

function sourceCitation(sourceUrl) {
  return `원문. [짐코딩](${sourceUrl})`;
}

function findLocalPage(db, title, sourceUrl) {
  const byTitle = db
    .prepare(
      "SELECT id, title FROM custom_pages WHERE user_id = ? AND title = ?"
    )
    .get(LOCAL_USER, title);
  if (byTitle) return byTitle;
  if (sourceUrl) {
    const cols = db.prepare("PRAGMA table_info(custom_pages)").all().map((c) => c.name);
    if (cols.includes("source_url")) {
      const bySource = db
        .prepare(
          "SELECT id, title FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1"
        )
        .get(LOCAL_USER, sourceUrl);
      if (bySource) return bySource;
    }
    const byContent = db
      .prepare(
        `SELECT id, title FROM custom_pages
         WHERE user_id = ? AND content LIKE ?
         LIMIT 1`
      )
      .get(LOCAL_USER, `%${sourceCitation(sourceUrl)}%`);
    if (byContent) return byContent;
  }
  return null;
}

function loadLocalSkipIndex(db) {
  const titles = new Set();
  const urls = new Set();
  const cols = db.prepare("PRAGMA table_info(custom_pages)").all().map((c) => c.name);
  const hasSource = cols.includes("source_url");
  const rows = hasSource
    ? db
        .prepare("SELECT title, source_url FROM custom_pages WHERE user_id = ?")
        .all(LOCAL_USER)
    : db.prepare("SELECT title FROM custom_pages WHERE user_id = ?").all(LOCAL_USER);
  for (const row of rows) {
    if (row.title) titles.add(row.title);
    if (row.source_url) urls.add(row.source_url);
  }
  return { titles, urls };
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

function insertLocal(db, page, libs) {
  const existing = findLocalPage(db, page.title, page.sourceUrl);
  if (existing) return { inserted: false, pageId: existing.id };
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
  return { inserted: true, pageId: page.id };
}

async function loadProdSkipIndex(supabase) {
  const titles = new Set();
  const urls = new Set();
  const pageSize = 50;
  for (let from = 0; ; from += pageSize) {
    let { data, error } = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .range(from, from + pageSize - 1);
    if (error && /source_url/i.test(error.message)) {
      const fallback = await supabase
        .from("custom_pages")
        .select("id, title")
        .eq("user_id", PROD_USER)
        .range(from, from + pageSize - 1);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.title) titles.add(row.title);
      if (row.source_url) urls.add(row.source_url);
    }
    if (!data || data.length < pageSize) break;
  }
  return { titles, urls };
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

  if (sourceUrl) {
    try {
      const bySource = await supabase
        .from("custom_pages")
        .select("id, title")
        .eq("user_id", PROD_USER)
        .eq("source_url", sourceUrl)
        .limit(1);
      if (bySource.error) {
        if (!/source_url/i.test(bySource.error.message)) throw bySource.error;
      } else if (bySource.data?.[0]) {
        return bySource.data[0];
      }
    } catch (error) {
      if (!/source_url/i.test(String(error?.message ?? error))) throw error;
    }

    try {
      const { data: byContent, error: contentError } = await supabase
        .from("custom_pages")
        .select("id, title")
        .eq("user_id", PROD_USER)
        .like("content", `%${sourceCitation(sourceUrl)}%`)
        .limit(1);
      if (contentError) {
        if (isTimeoutError(contentError)) return null;
        throw contentError;
      }
      if (byContent?.[0]) return byContent[0];
    } catch (error) {
      if (isTimeoutError(error)) return null;
      throw error;
    }
  }
  return null;
}

async function insertProduction(supabase, page, libs) {
  const existing = await findProductionPage(supabase, page.title, page.sourceUrl);
  if (existing) return { inserted: false, pageId: existing.id };
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
  return { inserted: true, pageId: page.id };
}

function createSupabase() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function shouldSkipKnown(url, localIndex, prodIndex) {
  if (SKIP_URLS.includes(url)) return true;
  if (localIndex.urls.has(url) && prodIndex.urls.has(url)) return true;
  return false;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const listHtml = await fetchText(LIST_URL);
  const listedUrls = listArticleUrlsFromHtml(listHtml);
  if (!listedUrls.length) throw new Error("아티클 목록이 비어 있습니다.");

  const summary = {
    listed: listedUrls.length,
    skipped: 0,
    insertedLocal: 0,
    insertedProd: 0,
    titles: [],
  };
  const failures = [];

  if (checkOnly) {
    for (let i = 0; i < listedUrls.length; i += 1) {
      const url = listedUrls[i];
      try {
        const built = await buildImportedPage(url, libs);
        summary.titles.push(built.title);
        console.error(`[check ${i + 1}/${listedUrls.length}] ${built.title}`);
      } catch (error) {
        const message = String(error?.message ?? error);
        console.error(`실패 ${url}. ${message}`);
        failures.push({ url, error: message });
      }
      if (i < listedUrls.length - 1) await pause(FETCH_GAP_MS);
    }
    console.log(JSON.stringify(summary, null, 2));
    if (failures.length) {
      throw new Error(`실패한 글 ${failures.length}건`);
    }
    return;
  }

  const db = new Database(resolve(root, "data/mymark.db"));
  const supabase = createSupabase();
  const localIndex = loadLocalSkipIndex(db);
  const prodIndex = await loadProdSkipIndex(supabase);

  try {
    for (let i = 0; i < listedUrls.length; i += 1) {
      const url = listedUrls[i];
      try {
        if (shouldSkipKnown(url, localIndex, prodIndex)) {
          summary.skipped += 1;
          console.error(`[skip ${i + 1}/${listedUrls.length}] ${url}`);
          continue;
        }
        const built = await buildImportedPage(url, libs);
        const localExists =
          localIndex.titles.has(built.title) ||
          localIndex.urls.has(built.sourceUrl) ||
          Boolean(findLocalPage(db, built.title, built.sourceUrl));
        const prodExists =
          prodIndex.titles.has(built.title) || prodIndex.urls.has(built.sourceUrl);
        if (localExists && prodExists) {
          summary.skipped += 1;
          console.error(`[skip ${i + 1}/${listedUrls.length}] ${built.title}`);
          continue;
        }

        const now = new Date().toISOString();
        const record = {
          id: randomUUID(),
          title: built.title,
          content: built.content,
          sourceUrl: built.sourceUrl,
          created_at: now,
          updated_at: now,
        };
        let insertedAnywhere = false;
        if (!localExists) {
          const local = insertLocal(db, record, libs);
          if (local.inserted) {
            summary.insertedLocal += 1;
            insertedAnywhere = true;
            localIndex.titles.add(built.title);
            localIndex.urls.add(built.sourceUrl);
          }
          record.id = local.pageId;
        }
        if (!prodExists) {
          const production = await insertProduction(supabase, record, libs);
          if (production.inserted) {
            summary.insertedProd += 1;
            insertedAnywhere = true;
            prodIndex.titles.add(built.title);
            prodIndex.urls.add(built.sourceUrl);
          }
        }
        if (insertedAnywhere) summary.titles.push(built.title);
        else summary.skipped += 1;
        console.error(
          `[${i + 1}/${listedUrls.length}] ${built.title} local=${summary.insertedLocal} prod=${summary.insertedProd}`
        );
      } catch (error) {
        const message = String(error?.message ?? error);
        console.error(`실패 ${url}. ${message}`);
        failures.push({ url, error: message });
      }
      if (i < listedUrls.length - 1) await pause(FETCH_GAP_MS);
    }
  } finally {
    db.close();
  }

  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) {
    throw new Error(`실패한 글 ${failures.length}건`);
  }
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
