// 짐코딩 Matt Pocock 스킬 설치 가이드를 Pages에만 저장한다
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
const OG_IMAGE_URL =
  "https://www.gymcoding.co/articles/matt-pocock-ai-skills-install-guide/opengraph-image-1ya3q7?052be9e71b4cd640";
const SKIP_IMAGE_RE = /logo\.svg/i;
const FETCH_URL =
  "https://www.gymcoding.co/articles/matt-pocock-ai-skills-install-guide";

export const SOURCE_URL =
  "https://www.gymcoding.co/articles/matt-pocock-ai-skills-install-guide";
export const PAGE_TITLE =
  "Matt Pocock 스킬 설치와 활용법: 요즘 AI 잘 쓰는 사람은 프롬프트를 매번 쓰지 않습니다";
export const REQUIRED_PHRASES = [
  "이런 분을 위한 글입니다",
  "claude plugins install mattpocock-skills",
  "/grill-me",
  "/handoff",
  "/teach",
  "/research",
  "v1.2.0 기준 전체 스킬 22개",
  "정상일 수 있습니다. 일부 스킬은 사용자만 직접 실행하도록 설정되어 있습니다.",
];

const faqPath = resolve(dirname(fileURLToPath(import.meta.url)), "import-gymcoding-matt-pocock-faq.json");
const faqs = JSON.parse(readFileSync(faqPath, "utf8"));

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

function stripFbclid(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url, SITE_ORIGIN);
    parsed.searchParams.delete("fbclid");
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return url
      .replace(/[?&]fbclid=[^&\s)#]*/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

function toAbsoluteUrl(url) {
  if (!url) return url;
  if (/^(https?:|data:|mailto:)/i.test(url)) return stripFbclid(url);
  try {
    return stripFbclid(new URL(url, SITE_ORIGIN).href);
  } catch {
    return stripFbclid(url);
  }
}

export function fillFaqAnswers(markdown) {
  let text = markdown;
  for (const item of faqs) {
    const heading = `### ${item.q}`;
    const escaped = item.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(### ${escaped})\\n+(?=### |## |$)`);
    if (pattern.test(text)) {
      text = text.replace(pattern, `$1\n\n${item.a}\n\n`);
    } else if (text.includes(heading) && !text.includes(item.a)) {
      text = text.replace(heading, `${heading}\n\n${item.a}`);
    }
  }
  return text;
}

export function cleanArticleMarkdown(markdown) {
  let text = markdown
    .replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${toAbsoluteUrl(path)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripFbclid(url));

  const promoNeedles = [
    "짐코딩 뉴스레터",
    "동의하고 구독",
    "privacy#newsletter",
    "인프런",
    "클로드 코드 완벽 마스터",
    "인프런에서 수강하기",
    "inf.run",
  ];
  text = text
    .split(/\n{2,}/)
    .filter((block) => !promoNeedles.some((needle) => block.includes(needle)))
    .join("\n\n");
  text = text.replace(/[?&]fbclid=[^&\s)#]*/g, "");
  text = text.replace(/fbclid/g, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function buildPageMarkdown(articleMarkdown, coverDataUrl) {
  return [
    `# ${PAGE_TITLE}`,
    `> 원문. [짐코딩](${SOURCE_URL})`,
    `![표지](${coverDataUrl})`,
    articleMarkdown,
  ].join("\n\n");
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
    headers: { "user-agent": "Mozilla/5.0", referer: SOURCE_URL },
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

function removePromoBlocks($, content) {
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

function unwrapHeadings($, content) {
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
  const fences = [...markdown.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)].map(
    (match) => match[1]
  );
  if (!fences.some((body) => body.includes("온라인 강의를 만들 계획이야"))) {
    throw new Error("/grill-me 실습 입력이 코드 펜스 안에 없습니다.");
  }
  const extractPageMediaReferences = loadExtractPageMediaReferences();
  const media = extractPageMediaReferences(content);
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  if (media.imageSources.length < 1) {
    throw new Error(`본문 이미지가 부족합니다. ${media.imageSources.length}`);
  }
  for (const forbidden of [
    "fbclid",
    "동의하고 구독",
    "짐코딩 뉴스레터",
    "인프런",
    "클로드 코드 완벽 마스터",
    "/logo.svg",
    "opengraph-image",
  ]) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  return media;
}

async function buildImportedPage() {
  const response = await fetch(FETCH_URL, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  const content = $("article.py-page-y").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");

  content.find("header h1").remove();
  unwrapHeadings($, content);
  removePromoBlocks($, content);
  content.find("button, svg").remove();

  content.find("img").each((_, image) => {
    let imageUrl = imageSrcOf(image, $);
    if (!imageUrl) {
      $(image).remove();
      return;
    }
    imageUrl = new URL(imageUrl, SOURCE_URL).href.replace(/^http:\/\//, "https://");
    if (isSkipImage(imageUrl)) {
      $(image).remove();
      return;
    }
    $(image).remove();
  });

  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", toAbsoluteUrl(href));
  });

  const coverDataUrl = await downloadImage(OG_IMAGE_URL);

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
  const articleMarkdown = fillFaqAnswers(
    cleanArticleMarkdown(turndown.turndown(content.html() || "").trim())
  );
  const markdown = buildPageMarkdown(articleMarkdown, coverDataUrl);
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
    .prepare(
      "SELECT id, title, content FROM custom_pages WHERE user_id = ? AND title = ?"
    )
    .get(LOCAL_USER, title);
  if (byTitle) return byTitle;
  const bySource = db
    .prepare(
      `SELECT id, title, content FROM custom_pages
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
  if (existing && existing.content === page.content) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    db.close();
    return result;
  }
  if (existing) {
    db.prepare(
      "UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
    ).run(page.content, page.updated_at, existing.id, LOCAL_USER);
    result.pageUpdates += 1;
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
    .select("id, title, content")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return { row: data[0], byTitle: true };

  try {
    const { data: bySource, error: sourceError } = await supabase
      .from("custom_pages")
      .select("id, title")
      .eq("user_id", PROD_USER)
      .like("content", `%${SOURCE_URL}%`)
      .limit(1);
    if (sourceError) {
      if (isTimeoutError(sourceError)) return { row: null, byTitle: false };
      throw sourceError;
    }
    if (bySource?.[0]) return { row: { ...bySource[0], content: "" }, byTitle: false };
    return { row: null, byTitle: false };
  } catch (error) {
    if (isTimeoutError(error)) return { row: null, byTitle: false };
    throw error;
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
  const found = await findProductionPage(supabase, page.title);
  const faqMarker =
    "정상일 수 있습니다. 일부 스킬은 사용자만 직접 실행하도록 설정되어 있습니다.";
  if (found.row && found.byTitle) {
    const hasFaq = String(found.row.content || "").includes(faqMarker);
    if (hasFaq) {
      result.pageSkips += 1;
      result.pageId = found.row.id;
      return result;
    }
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
