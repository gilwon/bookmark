// 리틀리 프로필과 영선 오픈소스 글을 Pages에만 저장한다
import { randomUUID } from "node:crypto";
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
const USER_AGENT = "bookmark-page-import/1.0";
const FILE_HREF_RE = /\.(pdf|docx?|xlsx?|pptx?|csv|txt)(?:$|[?#])/i;

export const LITTLY_URL = "https://litt.ly/dakjfsdf";
export const LITTLY_TITLE = "every._ai · 클로드 실전 자료";
export const LITTLY_SUBTITLE = "댓글 키워드를 눌러 자료를 바로 받으세요";
export const LITTLY_LINKS = [
  "https://every-ai-guides.vercel.app/instatoon-premium",
  "https://every-ai-guides.vercel.app/posts/claude-design-skills-5",
  "https://every-ai-guides.vercel.app/posts/claude-document-skills-4",
  "https://every-ai-guides.vercel.app/posts/ui-mcp-5",
  "https://every-ai-guides.vercel.app/posts/claude-commands-5",
  "https://every-ai-guides.vercel.app/posts/claude-connectors-5",
];

export const YEONGSEON_URL =
  "https://yeongseon.kr/archive/3e9d86104de280d3a3d3c2fdf6bf80e1.html";
export const YEONGSEON_TITLE = "AI 개발자들이 매일 쓰는 무료 오픈소스 3개";
export const YEONGSEON_LINKS = [
  "https://ollama.com/",
  "https://github.com/ollama/ollama",
  "https://www.python.org/downloads/",
  "https://github.com/microsoft/markitdown",
  "https://cloud.dify.ai/",
  "https://www.docker.com/products/docker-desktop/",
  "https://github.com/langgenius/dify",
];
const YEONGSEON_FORBIDDEN = [
  TRACKING_KEY,
  "utm_source",
  "open.kakao.com",
  "D-DAY",
  "이어서 볼 것",
  "이메일로 받아",
  "bit.ly/4ceB2Xu",
  "cafeptthumb",
];

const envPath = resolve(root, ".env.local");
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

const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === TRACKING_KEY ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1") ||
    (key === "from" &&
      (value === "dm" || value === "guide" || value === "littly"))
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
      .replace(/[?&]from=(?:dm|guide|littly)(?=[&#]|$)/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** localhost가 아니면 http를 https로 올린다. */
export function upgradeHttp(url) {
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

export function sourceMarkers(url) {
  const clean = stripTracking(url);
  return [...new Set([clean].filter(Boolean))];
}

function sameSource(source, markers) {
  if (!source) return false;
  if (markers.some((marker) => marker && source === marker)) return true;
  const cleaned = stripTracking(source);
  return markers.some((marker) => marker && cleaned === marker);
}

/** 제목이 같거나 원문 주소가 같으면 중복이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (title && row.title === title) return true;
  return sameSource(row.source_url, markers ?? []);
}

function sourceHit(rows, markers) {
  return (
    (rows ?? []).find((row) => sameSource(row.source_url, markers)) ?? null
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
    (localTitle && !sameSource(localTitle.source_url, markers) && localTitle) ||
    (prodTitle && !sameSource(prodTitle.source_url, markers) && prodTitle) ||
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

function littlyImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return stripTracking(path);
  }
  return `https://cdn.litt.ly${path.startsWith("/") ? path : `/${path}`}`;
}

/** 리틀리 HTML의 base64 프로필을 읽는다. */
export function profileFromHtml(html) {
  const $ = cheerio.load(html);
  const raw = $("script")
    .toArray()
    .map((el) => $(el).text().trim())
    .find((text) => text.startsWith("eyJ"));
  if (!raw) throw new Error("리틀리 프로필 데이터가 없습니다.");
  const data = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  const profile = data.profile ?? {};
  const cards = [];
  for (const block of data.blocks ?? []) {
    if (block.use === false) continue;
    if (block.type === "link" && block.url) {
      cards.push({
        title: String(block.title ?? "").replace(/\s+/g, " ").trim(),
        url: stripTracking(block.url),
        imageUrl: littlyImageUrl(block.image?.url),
      });
    }
    if (block.type === "productLink") {
      for (const link of block.links ?? []) {
        if (link.use === false || !link.url) continue;
        cards.push({
          title: String(link.title ?? "").replace(/\s+/g, " ").trim(),
          url: stripTracking(link.url),
          imageUrl: littlyImageUrl(link.image?.url),
        });
      }
    }
  }
  return {
    title: String(profile.title ?? "").replace(/\s+/g, " ").trim(),
    subtitle: String(profile.subtitle ?? "").replace(/\s+/g, " ").trim(),
    profileImageUrl: littlyImageUrl(profile.image?.url),
    cards,
  };
}

function markdownImage(alt, src) {
  const label = String(alt ?? "").replace(/[\[\]]/g, "").trim() || "이미지";
  return `![${label}](${src})`;
}

/** 리틀리 프로필을 저장용 마크다운으로 바꾼다. */
export function littlyMarkdown(profile, images, sourceUrl = LITTLY_URL) {
  const title = profile.title || LITTLY_TITLE;
  const lines = [
    `# ${title}`,
    `> 원문. [litt.ly](${sourceUrl})`,
  ];
  const profileSrc = images.get(profile.profileImageUrl);
  if (profile.profileImageUrl && !profileSrc) {
    throw new Error("프로필 이미지가 없습니다.");
  }
  if (profileSrc) lines.push(markdownImage(title, profileSrc));
  if (profile.subtitle) lines.push(profile.subtitle);
  for (const card of profile.cards) {
    if (card.imageUrl) {
      const src = images.get(card.imageUrl);
      if (!src) throw new Error(`카드 이미지가 없습니다. ${card.title}`);
      lines.push(markdownImage(card.title, src));
    }
    const label = card.title || card.url;
    lines.push(`[${label}](${card.url})`);
  }
  return { title, markdown: lines.join("\n\n").trim() };
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
      const $table = cheerio.load(table.outerHTML || "<table></table>");
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

function liftTableLinks($, article) {
  article.find("td a, th a").each((_, link) => {
    const node = $(link);
    const href = node.attr("href");
    if (!href) return;
    const label = node.text().replace(/\s+/g, " ").trim() || href;
    node.replaceWith(`[${label}](${href})`);
  });
}

function protectDateLines(markdown) {
  const lines = String(markdown ?? "").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^(```+|~~~+)/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      if (inFence || /^\u200B/.test(line)) return line;
      if (/^\d{4}\.\s+\d{1,2}\./.test(line)) return `\u200B${line}`;
      return line;
    })
    .join("\n");
}

function rewriteUrls(markdown, base) {
  const lines = String(markdown ?? "").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^(```+|~~~+)/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(/https?:\/\/[^\s)]+/g, (url) =>
        upgradeHttp(stripTracking(url, base))
      );
    })
    .join("\n");
}

function cleanYeongseonArticle($, article) {
  article.find("ul.chips, nav.rel, .cta, aside.promo, script, style, noscript").remove();
  article.find("aside.note").each((_, el) => {
    const text = $(el).text();
    if (text.includes("D-DAY") || text.includes("이 글을 보는 분들께") || text.includes("단톡방")) {
      $(el).remove();
    }
  });
  article.find("p").each((_, el) => {
    const node = $(el);
    if (node.parents("ol, ul, pre, table").length) return;
    if (/^\d+\.\s+/.test(node.text())) node.prepend("\u200B");
  });
  liftTableLinks($, article);
}

/** 영선 아카이브 HTML을 저장용 마크다운으로 바꾼다. */
export function parseYeongseonHtml(html, sourceUrl = YEONGSEON_URL) {
  const $ = cheerio.load(html);
  const article = $("article.wrap").first();
  if (!article.length) throw new Error("본문 영역을 찾지 못했습니다.");
  cleanYeongseonArticle($, article);
  article.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:") || href.startsWith("mailto:")) return;
    $(link).attr("href", upgradeHttp(stripTracking(href, sourceUrl)));
  });
  article.find("img").each((_, image) => {
    const src = $(image).attr("src") || "";
    if (!src || src.startsWith("data:")) return;
    $(image).attr("src", upgradeHttp(stripTracking(src, sourceUrl)));
  });
  const h1 = article.find("h1").first();
  const title = h1.text().replace(/\s+/g, " ").trim() || YEONGSEON_TITLE;
  h1.remove();
  const body = createTurndown()
    .turndown(article.html() || "")
    .replace(/\\([\[\]\.])/g, "$1")
    .trim();
  const markdown = protectDateLines(
    rewriteUrls(
      [`# ${title}`, `> 원문. [신영선 자료](${sourceUrl})`, body]
        .filter(Boolean)
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
      sourceUrl
    )
  );
  return { title, markdown };
}

async function fetchBytes(url, referer) {
  let lastError = new Error(`받지 못했습니다. ${url}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, referer },
      });
      if (response.ok) {
        return {
          bytes: new Uint8Array(await response.arrayBuffer()),
          header: response.headers.get("content-type"),
          finalUrl: response.url || url,
        };
      }
      lastError = new Error(`HTTP ${response.status}: ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await pause(400 * (attempt + 1));
  }
  throw lastError;
}

async function downloadImage(url, referer) {
  const { bytes, header } = await fetchBytes(url, referer);
  const mime = imageMime(bytes, header);
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function isZipHref(href) {
  return /\.zip(?:$|[?#])/i.test(href);
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

async function inlineYeongseonFiles($, article, sourceUrl) {
  for (const image of article.find("img").toArray()) {
    const src = $(image).attr("src") || "";
    if (!src || src.startsWith("data:image")) continue;
    $(image).attr("src", await downloadImage(src, sourceUrl));
    $(image).removeAttr("srcset");
  }
  for (const link of article.find("a[href]").toArray()) {
    const href = $(link).attr("href") || "";
    if (!href || href.startsWith("data:")) continue;
    if (isZipHref(href)) continue;
    if (!isFileHref(href)) continue;
    const { bytes, header } = await fetchBytes(href, sourceUrl);
    const name = decodeURIComponent(new URL(href).pathname.split("/").filter(Boolean).at(-1) || "첨부");
    const mime = header?.split(";")[0] || "application/octet-stream";
    if (mime.startsWith("text/html")) continue;
    const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    $(link).attr("href", dataUrl);
    if (!$(link).text().trim()) $(link).text(name);
  }
}

function assertLittly(markdown, stats) {
  if (!markdown.startsWith(`# ${LITTLY_TITLE}`)) {
    throw new Error("리틀리 제목이 다릅니다.");
  }
  if (!markdown.includes(LITTLY_SUBTITLE)) throw new Error("리틀리 소개가 없습니다.");
  if (!markdown.includes(`> 원문. [litt.ly](${LITTLY_URL})`)) {
    throw new Error("리틀리 원문이 없습니다.");
  }
  for (const url of LITTLY_LINKS) {
    if (!markdown.includes(url)) throw new Error(`리틀리 링크가 없습니다. ${url}`);
  }
  if (stats.images !== 7) throw new Error(`리틀리 이미지가 ${stats.images}장입니다.`);
  if (stats.attachments !== 0) throw new Error("리틀리 첨부가 있습니다.");
  if (markdown.includes(TRACKING_KEY) || markdown.includes("utm_source") || markdown.includes("from=littly")) {
    throw new Error("리틀리 추적 쿼리가 남아 있습니다.");
  }
}

function assertYeongseon(markdown, stats) {
  if (!markdown.startsWith(`# ${YEONGSEON_TITLE}`)) {
    throw new Error("영선 제목이 다릅니다.");
  }
  if (markdown.split("\n")[0].includes("—")) {
    throw new Error("영선 제목 줄에 대시가 있습니다.");
  }
  if (!markdown.includes("10배 더 빠르게 흡수하는 방법")) {
    throw new Error("영선 흡수 안내가 없습니다.");
  }
  if (!markdown.includes("ollama run qwen3")) throw new Error("올라마 명령이 없습니다.");
  if (!markdown.includes("http://localhost/install")) {
    throw new Error("로컬 설치 주소가 없습니다.");
  }
  for (const url of YEONGSEON_LINKS) {
    if (!markdown.includes(url)) throw new Error(`영선 링크가 없습니다. ${url}`);
  }
  for (const phrase of YEONGSEON_FORBIDDEN) {
    if (markdown.includes(phrase)) throw new Error(`영선 금지 문구가 남았습니다. ${phrase}`);
  }
  if (stats.images !== 0) throw new Error(`영선 이미지가 ${stats.images}장입니다.`);
  if (stats.attachments !== 0) throw new Error(`영선 첨부가 ${stats.attachments}개입니다.`);
  if (stats.codes < 4) throw new Error(`영선 코드가 ${stats.codes}개입니다.`);
}

function sqliteHasFindability(db) {
  const cols = db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) => cols.includes(name));
}

function loadLocalRows(db) {
  const cols = db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  return db.prepare(`SELECT ${fields.join(", ")} FROM custom_pages WHERE user_id = ?`).all(LOCAL_USER);
}

async function loadProductionRows(supabase, targets) {
  const rows = [];
  const seen = new Set();
  const push = (data) => {
    for (const row of data ?? []) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  };
  for (const target of targets) {
    const byTitle = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .eq("title", target.title)
      .limit(5);
    if (byTitle.error) throw byTitle.error;
    push(byTitle.data);
    for (const marker of target.markers) {
      const bySource = await supabase
        .from("custom_pages")
        .select("id, title, source_url")
        .eq("user_id", PROD_USER)
        .eq("source_url", marker)
        .limit(1);
      if (bySource.error) {
        if (/source_url/i.test(bySource.error.message)) return rows;
        throw bySource.error;
      }
      push(bySource.data);
    }
  }
  return rows;
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
  const existing = loadLocalRows(db).find((row) => isDuplicateRow(row, page.title, markers));
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
    ).run(page.id, LOCAL_USER, page.title, page.content, page.created_at, page.updated_at);
  }
  result.pages += 1;
  db.close();
  return result;
}

async function importProduction(supabase, page, markers, libs) {
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const rows = await loadProductionRows(supabase, [{ title: page.title, markers }]);
  const existing = rows.find((row) => isDuplicateRow(row, page.title, markers));
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

async function persist(supabase, page, markers, libs, preferredId) {
  const now = new Date().toISOString();
  const record = {
    id: preferredId || randomUUID(),
    title: page.title,
    content: page.content,
    sourceUrl: page.sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markers, libs);
  record.id = local.pageId;
  let production;
  try {
    production = await importProduction(supabase, record, markers, libs);
  } catch (error) {
    if (local.pages === 1) {
      const db = new Database(resolve(root, "data/mymark.db"));
      db.prepare("DELETE FROM custom_pages WHERE id = ? AND user_id = ?").run(record.id, LOCAL_USER);
      db.close();
    }
    throw error;
  }
  return {
    pageId: production.pageSkips ? production.pageId : local.pageId,
    localPages: local.pages,
    localSkips: local.pageSkips,
    prodPages: production.pages,
    prodSkips: production.pageSkips,
  };
}

async function buildLittly(libs) {
  const response = await fetch(LITTLY_URL, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`리틀리 HTTP ${response.status}`);
  const profile = profileFromHtml(await response.text());
  if (profile.title !== LITTLY_TITLE) throw new Error(`리틀리 제목이 다릅니다. ${profile.title}`);
  const images = new Map();
  const urls = [profile.profileImageUrl, ...profile.cards.map((card) => card.imageUrl)].filter(Boolean);
  for (const url of urls) {
    if (images.has(url)) continue;
    images.set(url, await downloadImage(url, LITTLY_URL));
    await pause(200);
  }
  const parsed = littlyMarkdown(profile, images);
  const content = JSON.stringify(libs.markdownToTiptapDoc(parsed.markdown));
  const stats = documentStats(content);
  assertLittly(parsed.markdown, stats);
  return { ...parsed, content, stats, sourceUrl: LITTLY_URL };
}

async function buildYeongseon(libs) {
  const response = await fetch(YEONGSEON_URL, {
    headers: { "user-agent": USER_AGENT, referer: YEONGSEON_URL },
  });
  if (!response.ok) throw new Error(`영선 HTTP ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const article = $("article.wrap").first();
  cleanYeongseonArticle($, article);
  await inlineYeongseonFiles($, article, YEONGSEON_URL);
  const parsed = parseYeongseonHtml($.html(), YEONGSEON_URL);
  if (parsed.title !== YEONGSEON_TITLE) throw new Error(`영선 제목이 다릅니다. ${parsed.title}`);
  const content = JSON.stringify(libs.markdownToTiptapDoc(parsed.markdown));
  const stats = documentStats(content);
  assertYeongseon(parsed.markdown, stats);
  return { ...parsed, content, stats, sourceUrl: YEONGSEON_URL };
}

const TARGETS = [
  { key: "littly", title: LITTLY_TITLE, sourceUrl: LITTLY_URL, build: buildLittly },
  { key: "yeongseon", title: YEONGSEON_TITLE, sourceUrl: YEONGSEON_URL, build: buildYeongseon },
];

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
  const localDb = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const localRows = loadLocalRows(localDb);
  localDb.close();
  const prodRows = await loadProductionRows(
    supabase,
    TARGETS.map((target) => ({
      title: target.title,
      markers: sourceMarkers(target.sourceUrl),
    }))
  );
  const pages = [];
  for (const target of TARGETS) {
    const markers = sourceMarkers(target.sourceUrl);
    const decision = decideSkip(localRows, prodRows, target.title, markers);
    if (decision.skip) {
      pages.push({ key: target.key, action: "skip", pageId: decision.pageId, title: decision.title });
      continue;
    }
    const built = await target.build(libs);
    const again = decideSkip(localRows, prodRows, built.title, markers);
    if (again.skip) {
      pages.push({
        key: target.key,
        action: "skip",
        pageId: again.pageId,
        title: again.title,
        images: built.stats.images,
        attachments: built.stats.attachments,
        codes: built.stats.codes,
      });
      continue;
    }
    if (checkOnly) {
      pages.push({
        key: target.key,
        action: "check",
        title: built.title,
        images: built.stats.images,
        attachments: built.stats.attachments,
        codes: built.stats.codes,
        links: built.stats.links,
      });
      continue;
    }
    const saved = await persist(
      supabase,
      { title: built.title, content: built.content, sourceUrl: built.sourceUrl },
      markers,
      libs,
      again.preferredId
    );
    if (saved.localPages) {
      localRows.push({ id: saved.pageId, title: built.title, source_url: built.sourceUrl });
    }
    if (saved.prodPages) {
      prodRows.push({ id: saved.pageId, title: built.title, source_url: built.sourceUrl });
    }
    const action = saved.localPages + saved.prodPages > 0 ? "insert" : "skip";
    pages.push({
      key: target.key,
      action,
      pageId: saved.pageId,
      title: built.title,
      images: built.stats.images,
      attachments: built.stats.attachments,
      codes: built.stats.codes,
      links: built.stats.links,
    });
  }
  const text = JSON.stringify({ pages });
  if (text.includes("data:")) throw new Error("출력에 data URL이 있습니다.");
  console.log(text);
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
