// 심팀장 주말 클로드 5개 글을 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { documentStats } from "./import-claude-eli5-page.mjs";
import { imageDataUrl } from "./import-every-ai-index-20261013.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const TRACKING_KEY = ["fb", "clid"].join("");

export const WEEKEND_URL = "https://shimteamjjang.vercel.app/weekend";
export const WEEKEND_TITLE = "주말에 클로드로 만들어 볼 다섯 개";
export const WEEKEND_IMAGE_ALT = "심팀장님 캐릭터";

const WEEKEND_ORIGIN = "https://shimteamjjang.vercel.app";
const PNG_BYTES = 157715;
const PNG_SHA256 = "16783911aa2134a0d6ba1f02c74eb261fd7bc536fb5eb9bd6b23feae139ddef2";

export const WEEKEND_EXPECTED = { images: 1, attachments: 0, tables: 1, codes: 5 };

const WEEKEND_HREFS = [WEEKEND_URL];
const WEEKEND_PHRASES = [
  "에이전트 팀 · 웹사이트 · 세컨드 브레인 · 대시보드 · 주간 회고",
  "시킬 문장 예시",
  "한눈에",
  "꼭 알아둘 것",
  "나는 [내 분야] 콘텐츠를 만들어.",
  "내 경력과 하고 싶은 일을 소개하는 웹사이트를 한 페이지로 만들어 줘.",
  "이 폴더 안의 문서와 메모를 주제별로 나눠서 한 폴더에 모아 줘.",
  "내 할 일과 돈 관리를 한 화면에서 보는 대시보드를 만들어 줘.",
  "지난 일주일 동안 나와 나눈 대화를 돌아보고",
  "영상 속 말",
  "예시 문장",
  "팔로우 해주세요",
  "이 자료는 해외 크리에이터 영상의 소개 내용을 바탕으로 정리한 것이고 직접 실행해 확인한 것은 아니에요.",
  WEEKEND_IMAGE_ALT,
];
const FIRST_FENCE =
  "나는 [내 분야] 콘텐츠를 만들어. 잘 된 글감을 찾아 모으는 역할, 이미지와 릴스 초안을 만드는 역할, 올릴 글을 정리하는 역할로 나눠서 일할 팀을 같이 설계해 줘. 먼저 역할과 순서만 표로 보여 줘.";
const FORBIDDEN = [
  TRACKING_KEY,
  "utm_source",
  "gclid",
  "og-weekend.png",
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
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

/** 양쪽이 같으면 skip, 한쪽만 있으면 split, 없으면 import. */
export function presenceAction(hasLocal, hasProd) {
  if (Boolean(hasLocal) === Boolean(hasProd)) return hasLocal ? "skip" : "import";
  return "split";
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

function rewriteHref(href) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("data:")) {
    return href;
  }
  return stripTracking(href, `${WEEKEND_ORIGIN}/`);
}

/** 주말 글의 .wrap을 마크다운으로 만든다. 이미지는 이미 data URL이어야 한다. */
export function weekendMarkdownFromHtml(html) {
  const $ = cheerio.load(String(html ?? ""));
  const wrap = $(".wrap").first();
  if (!wrap.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const heading = wrap.find("h1").first().clone();
  heading.find("br").replaceWith(" ");
  const title = heading.text().replace(/\s+/g, " ").trim();
  if (title !== WEEKEND_TITLE) throw new Error(`제목이 다릅니다. ${title}`);
  wrap.find("script, style, noscript").remove();
  dropCopyBars($, wrap);
  wrap.find("img").each((_, image) => {
    const src = $(image).attr("src") || "";
    if (src.includes("og-weekend.png")) throw new Error("소셜 카드는 본문 이미지가 아닙니다.");
    if (!src.startsWith("data:image/")) throw new Error("이미지가 data URL이 아닙니다.");
    if (!$(image).attr("alt")) $(image).attr("alt", WEEKEND_IMAGE_ALT);
  });
  wrap.find("h1").remove();
  wrap.find("a[href]").each((_, link) => {
    const href = $(link).attr("href") || "";
    $(link).attr("href", rewriteHref(href));
  });
  const body = finishMarkdown(createTurndown().turndown(wrap.html() || ""));
  return markdownDocument(WEEKEND_TITLE, "심팀장", WEEKEND_URL, body);
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

function assertPage({ markdown, content, stats }) {
  if (!markdown.startsWith(`# ${WEEKEND_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(WEEKEND_URL) || !content.includes(WEEKEND_URL)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const phrase of WEEKEND_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== WEEKEND_EXPECTED.images) {
    throw new Error(`이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== WEEKEND_EXPECTED.attachments) {
    throw new Error(`첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== WEEKEND_EXPECTED.tables) throw new Error(`표 수가 다릅니다. ${stats.tables}`);
  if (stats.codes !== WEEKEND_EXPECTED.codes) throw new Error(`코드 수가 다릅니다. ${stats.codes}`);
  const actual = publicHrefs(stats.hrefs);
  if (actual.length !== WEEKEND_HREFS.length || actual.some((href, index) => href !== WEEKEND_HREFS[index])) {
    throw new Error(`링크가 다릅니다. ${actual.join(" ")}`);
  }
  const plainMarkdown = visibleText(markdown);
  const plainContent = visibleText(content);
  for (const snippet of FORBIDDEN) {
    if (plainMarkdown.includes(snippet) || plainContent.includes(snippet)) {
      throw new Error(`제거 대상이 본문에 남아 있습니다. ${snippet}`);
    }
  }
  if (/^복사$/m.test(markdown)) throw new Error("복사 버튼이 남아 있습니다.");
  const block = markdown.match(/```\n([\s\S]*?)\n```/);
  const body = block?.[1] ?? "";
  if (body !== FIRST_FENCE) throw new Error("첫 코드 블록이 다릅니다.");
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
  };
}

async function inlineWeekendImage(html) {
  const $ = cheerio.load(html);
  const images = $(".wrap img").toArray();
  if (images.length !== WEEKEND_EXPECTED.images) {
    throw new Error(`캐릭터 이미지가 ${WEEKEND_EXPECTED.images}개여야 합니다. ${images.length}`);
  }
  const image = $(images[0]);
  const src = image.attr("src") || "";
  if (src.includes("og-weekend.png")) throw new Error("소셜 카드는 본문 이미지가 아닙니다.");
  if (!src.startsWith("data:image/")) {
    const absolute = new URL(src, WEEKEND_ORIGIN).href;
    const response = await fetchBytes(absolute);
    if (response.bytes.length !== PNG_BYTES || sha256(response.bytes) !== PNG_SHA256) {
      throw new Error("캐릭터 이미지 바이트가 원문과 다릅니다.");
    }
    image.attr("src", imageDataUrl(response.bytes, response.type));
  }
  image.attr("alt", image.attr("alt") || WEEKEND_IMAGE_ALT);
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
  const fields = ["id", "title"];
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
async function locate(supabase) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let localSource = null;
  let localTitle = null;
  try {
    localSource = findLocalBy(db, "source_url", WEEKEND_URL);
    localTitle = findLocalBy(db, "title", WEEKEND_TITLE);
  } finally {
    db.close();
  }
  const prodSource = await findProdBy(supabase, "source_url", WEEKEND_URL);
  const prodTitle = await findProdBy(supabase, "title", WEEKEND_TITLE);
  return { localSource, localTitle, prodSource, prodTitle };
}

function decisionOf(located) {
  const local = located.localSource || located.localTitle;
  const production = located.prodSource || located.prodTitle;
  const action = presenceAction(local, production);
  if (action === "split") {
    throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${WEEKEND_URL}`);
  }
  if (action === "skip") return { action, pageId: local.id };
  return { action, pageId: null, preferredId: null };
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
    const existing = findLocalBy(db, "source_url", page.sourceUrl) || findLocalBy(db, "title", page.title);
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

async function buildWeekend(libs) {
  const response = await fetchBytes(WEEKEND_URL);
  const prepared = await inlineWeekendImage(response.bytes.toString("utf8"));
  const markdown = weekendMarkdownFromHtml(prepared);
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertPage({ markdown, content, stats });
  return { markdown, content, stats };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const libs = loadLibs();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const before = decisionOf(await locate(supabase));
  if (!checkOnly && before.action === "skip") {
    emit({
      results: [
        {
          key: "weekend",
          action: "skip",
          title: WEEKEND_TITLE,
          pageId: before.pageId,
          path: `/pages/${before.pageId}`,
          sourceUrl: WEEKEND_URL,
          fetched: false,
        },
      ],
    });
    return;
  }
  const built = await buildWeekend(libs);
  const again = decisionOf(await locate(supabase));
  const rootCount = JSON.parse(built.content).content?.length ?? 0;
  if (checkOnly) {
    emit({
      results: [
        {
          key: "weekend",
          action: again.action === "skip" ? "skip" : "check",
          title: WEEKEND_TITLE,
          sourceUrl: WEEKEND_URL,
          images: built.stats.images,
          attachments: built.stats.attachments,
          tables: built.stats.tables,
          codes: built.stats.codes,
          links: built.stats.links,
          root: rootCount,
          hash: hashOf(built.content),
          length: built.content.length,
        },
      ],
    });
    return;
  }
  if (again.action === "skip") {
    emit({
      results: [
        {
          key: "weekend",
          action: "skip",
          title: WEEKEND_TITLE,
          pageId: again.pageId,
          path: `/pages/${again.pageId}`,
          sourceUrl: WEEKEND_URL,
          fetched: true,
        },
      ],
    });
    return;
  }
  const saved = await persist(
    supabase,
    {
      title: WEEKEND_TITLE,
      content: built.content,
      sourceUrl: WEEKEND_URL,
      preferredId: again.preferredId,
    },
    libs
  );
  emit({
    results: [
      {
        key: "weekend",
        action: saved.localPages + saved.prodPages > 0 ? "insert" : "skip",
        title: WEEKEND_TITLE,
        pageId: saved.pageId,
        path: `/pages/${saved.pageId}`,
        sourceUrl: WEEKEND_URL,
        images: built.stats.images,
        attachments: built.stats.attachments,
        tables: built.stats.tables,
        codes: built.stats.codes,
        links: built.stats.links,
        root: rootCount,
        hash: hashOf(built.content),
        length: built.content.length,
        createdAt: saved.createdAt,
        localPages: saved.localPages,
        prodPages: saved.prodPages,
        fetched: true,
      },
    ],
  });
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
