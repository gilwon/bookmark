// 스케일메이커 에이전트 뷰와 레플리카 복제 글을 Pages에만 저장한다.
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

export const SCALE_URL =
  "https://scalemaker.co/g/2026-10-15-claude-code-agent-view";
export const SCALE_TITLE =
  "클로드코드 에이전트 뷰(claude agents): 클로드 여러 명에게 동시에 일 맡기기";
export const CLONE_URL = "https://shimteamjjang.vercel.app/clone";
export const CLONE_TITLE = "클로드로 돈 내던 앱 복제하기";
export const CLONE_IMAGE_ALT = "심팀장님 캐릭터";

const SCALE_ORIGIN = "https://scalemaker.co";
const CLONE_ORIGIN = "https://shimteamjjang.vercel.app";

export const SCALE_EXPECTED = { images: 0, attachments: 0, tables: 0, codes: 1 };
export const CLONE_EXPECTED = { images: 1, attachments: 0, tables: 1, codes: 1 };

const SCALE_HREFS = [
  SCALE_URL,
  "https://code.claude.com/docs/en/agent-view",
  "https://code.claude.com/docs/en/whats-new/2026-w20",
  "https://github.com/anthropics/claude-code/releases/tag/v2.1.299",
  "https://github.com/anthropics/claude-code/releases/tag/v2.1.300",
  "https://scalemaker.co/courses",
  "https://www.instagram.com/ai_leeseul/",
];
const CLONE_HREFS = [
  CLONE_URL,
  "https://github.com/Jakeschincariol/replica-skill",
];
const SCALE_PHRASES = [
  "@ai_leeseul 정리본 · 2026-10-14",
  "1. 에이전트 뷰 열기",
  "2. 일 맡기기: 한 줄 쓰고 Enter",
  "3. 복붙용 업무 분담 프롬프트 6개",
  "4. 상태 색깔 읽는 법",
  "5. 엿보고 바로 답장하기 (Space)",
  "6. 들어가기 · 빠져나오기",
  "7. 단축키 한 장 정리",
  "8. 사용량 아끼는 주의점",
  "9. 삭제 전에 꼭 확인 (git 폴더라면)",
  "10. 안 될 때 체크리스트",
  "AI로 직접 수익까지 만들고 싶다면",
  '"blog 폴더의 메모.txt 를 보고 이번 주 블로그 글 3편 초안을 각각 새 파일로 써줘. 원래 메모는 고치지 마."',
  '"매출.xlsx 를 월별 합계 표로 정리해서 매출_월별.xlsx 로 새로 저장해줘."',
  '"우리 경쟁사 A, B, C 홈페이지에서 가격표를 찾아 비교표로 정리해줘. 출처 링크도 같이 적어줘."',
  '"고객문의 폴더의 메일 내용을 읽고 자주 묻는 질문 10개와 답변 초안을 FAQ.md 로 만들어줘."',
  '"이번 달 회의록 파일들을 읽고 할 일만 뽑아서 담당자별로 정리해줘."',
  '"인스타 캡션 아이디어 10개를 써줘. 다 쓰면 그중 제일 좋은 3개를 골라 이유도 적어줘."',
  "claude agents --json",
];
const CLONE_PHRASES = [
  "레플리카 스킬 11개 · 설치 한 줄 · 쓰는 순서 · 꼭 알아둘 것",
  "레플리카(Replica)",
  "꼭 알아둘 것",
  "/replica-recon",
  "/replica-architect",
  "/replica-design",
  "/replica-build",
  "/replica-backend",
  "/replica-test",
  "/replica-diff",
  "/replica-entrepreneur",
  "/replica-brand",
  "/replica-launch",
  "/replica-deploy",
  "참고: replica-skill README",
  "2026-10-09",
  CLONE_IMAGE_ALT,
];
const FORBIDDEN = [
  TRACKING_KEY,
  "utm_source",
  "gclid",
  "from=dm",
  "from=guide",
  "from=littly",
  "/brand/logo",
  "og/main.jpg",
  "og-clone.png",
  "이용약관",
  "개인정보처리방침",
  "pf.kakao.com",
  "youtube.com",
  "https://www.instagram.com/",
];
const EXPIRED_URL_PARTS = [
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
    const tracking = ["utm_[^=&#]*", TRACKING_KEY, "gclid", "pvs", "igsh", "mcp_token"].join(
      "|"
    );
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

function toAbsoluteUrl(url, origin) {
  if (!url || url.startsWith("data:") || url.startsWith("mailto:") || url.startsWith("#")) {
    return url;
  }
  try {
    return stripTracking(new URL(url, origin).href);
  } catch {
    return url;
  }
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

/** 단계 목록의 li를 꺼내 제목이 목록 안에 남지 않게 한다. */
function liftStepList($, content) {
  content.find("ol").each((_, ol) => {
    const list = $(ol);
    const parts = [];
    list.children("li").each((__, li) => {
      const item = $(li);
      item.children("span").each((___, span) => {
        if (/^\d{2}$/.test($(span).text().trim())) $(span).remove();
      });
      parts.push(item.html() || "");
    });
    list.before(parts.join(""));
    list.remove();
  });
}

function dropCopyBars($, content) {
  content.find("button").each((_, button) => {
    const bar = $(button).parent();
    if (bar.find("pre, table").length === 0) bar.remove();
    else $(button).remove();
  });
}

/** 펜스 안 글자는 그대로 두고, 밖에서는 이스케이프와 주소와 날짜만 고친다. */
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
      const restored = line
        .replace(/\\_/g, "_")
        .replace(/\\\./g, ".")
        .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url));
      if (/^\u200B/.test(restored)) return restored;
      if (/^\d{4}\.\s+\d{1,2}\./.test(restored)) return `\u200B${restored}`;
      return restored;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function quoteOf(siteName, sourceUrl) {
  return `> 원문. [${siteName}](${sourceUrl})`;
}

function markdownDocument(title, siteName, sourceUrl, body) {
  return [ `# ${title}`, quoteOf(siteName, sourceUrl), body ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 스케일메이커 본문만 마크다운으로 만든다. 네트워크는 쓰지 않는다. */
export function scaleMarkdownFromHtml(html) {
  const $ = cheerio.load(String(html ?? ""));
  const content = $("main").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const heading = content.find("h1").first().text().replace(/\s+/g, " ").trim();
  if (heading !== SCALE_TITLE) throw new Error(`제목이 다릅니다. ${heading}`);
  content.find("header, footer, nav, script, style, noscript").remove();
  dropCopyBars($, content);
  content.find("a[href], img[src]").each((_, el) => {
    const node = $(el);
    const ref = `${node.attr("href") || ""} ${node.attr("src") || ""}`;
    if (
      ["/brand/logo", "og/main.jpg", "pf.kakao.com", "youtube.com"].some((part) =>
        ref.includes(part)
      )
    ) {
      node.remove();
    }
  });
  content.find("img").remove();
  content.find("span").each((_, span) => {
    if (/^\d{2}$/.test($(span).text().trim())) $(span).remove();
  });
  liftStepList($, content);
  content.find("h1").remove();
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    $(link).attr("href", toAbsoluteUrl(href, SCALE_ORIGIN));
  });
  const body = finishMarkdown(createTurndown().turndown(content.html() || ""));
  return markdownDocument(SCALE_TITLE, "스케일메이커", SCALE_URL, body);
}

/** 레플리카 글의 .wrap을 마크다운으로 만든다. 이미지는 이미 data URL이어야 한다. */
export function cloneMarkdownFromHtml(html) {
  const $ = cheerio.load(String(html ?? ""));
  const wrap = $(".wrap").first();
  if (!wrap.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const heading = wrap.find("h1").first().clone();
  heading.find("br").replaceWith(" ");
  const title = heading.text().replace(/\s+/g, " ").trim();
  if (title !== CLONE_TITLE) throw new Error(`제목이 다릅니다. ${title}`);
  wrap.find("script, style, noscript").remove();
  dropCopyBars($, wrap);
  wrap.find("img").each((_, image) => {
    const src = $(image).attr("src") || "";
    if (!src.startsWith("data:image/")) throw new Error("이미지가 data URL이 아닙니다.");
  });
  wrap.find("h1").remove();
  wrap.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("data:")) {
      return;
    }
    $(link).attr("href", toAbsoluteUrl(href, CLONE_ORIGIN));
  });
  const body = finishMarkdown(createTurndown().turndown(wrap.html() || ""));
  return markdownDocument(CLONE_TITLE, "심팀장", CLONE_URL, body);
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

function assertPage({ markdown, content, stats, title, sourceUrl, phrases, hrefs, expected, fence }) {
  if (!markdown.startsWith(`# ${title}`)) throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  if (!markdown.includes(sourceUrl) || !content.includes(sourceUrl)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const phrase of phrases) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== expected.images) {
    throw new Error(`이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== expected.attachments) {
    throw new Error(`첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== expected.tables) {
    throw new Error(`표 수가 다릅니다. ${stats.tables}`);
  }
  if (stats.codes !== expected.codes) {
    throw new Error(`코드 수가 다릅니다. ${stats.codes}`);
  }
  const actual = publicHrefs(stats.hrefs);
  const expectedHrefs = [...hrefs].sort();
  if (
    actual.length !== expectedHrefs.length ||
    actual.some((href, index) => href !== expectedHrefs[index])
  ) {
    throw new Error(`링크가 다릅니다. ${actual.join(" ")}`);
  }
  const plainMarkdown = visibleText(markdown);
  const plainContent = visibleText(content);
  for (const snippet of FORBIDDEN) {
    if (snippet === "https://www.instagram.com/") {
      if (plainMarkdown.includes("https://www.instagram.com/") && !plainMarkdown.includes("https://www.instagram.com/ai_leeseul/")) {
        throw new Error("인스타그램 루트가 남아 있습니다.");
      }
      if (plainContent.includes("https://www.instagram.com/") && !plainContent.includes("https://www.instagram.com/ai_leeseul/")) {
        throw new Error("인스타그램 루트가 남아 있습니다.");
      }
      continue;
    }
    if (plainMarkdown.includes(snippet) || plainContent.includes(snippet)) {
      throw new Error(`제거 대상이 본문에 남아 있습니다. ${snippet}`);
    }
  }
  if (/^프롬프트$/m.test(markdown) || /^복사$/m.test(markdown)) {
    throw new Error("복사 버튼이 남아 있습니다.");
  }
  for (const part of EXPIRED_URL_PARTS) {
    if (plainMarkdown.includes(part) || plainContent.includes(part)) {
      throw new Error("만료 URL이 본문에 남아 있습니다.");
    }
  }
  const block = markdown.match(/```\n([\s\S]*?)\n```/);
  const body = block?.[1] ?? "";
  if (body !== fence) throw new Error("첫 코드 블록이 다릅니다.");
}

function hashOf(content) {
  const hash = createHash("sha256");
  hash.write(content);
  hash.end();
  return hash.digest("hex");
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

async function inlineCloneImage(html) {
  const $ = cheerio.load(html);
  const image = $(".wrap img").first();
  if (!image.length) throw new Error("캐릭터 이미지가 없습니다.");
  const src = image.attr("src") || "";
  if (src.startsWith("data:image/")) return $.html();
  const absolute = new URL(src, CLONE_ORIGIN).href;
  const response = await fetch(absolute, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  image.attr("src", imageDataUrl(bytes, response.headers.get("content-type") || ""));
  image.attr("alt", image.attr("alt") || CLONE_IMAGE_ALT);
  return $.html();
}

function pageColumns(db) {
  return db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
}

function sqliteHasFindability(db) {
  const columns = pageColumns(db);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) =>
    columns.includes(name)
  );
}

function findLocalBy(db, column, value) {
  if (!value) return null;
  const columns = pageColumns(db);
  if (column === "source_url" && !columns.includes("source_url")) return null;
  const fields = ["id", "title", "content"];
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
async function locate(supabase, title, sourceUrl) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let localSource = null;
  let localTitle = null;
  try {
    localSource = findLocalBy(db, "source_url", sourceUrl);
    localTitle = findLocalBy(db, "title", title);
  } finally {
    db.close();
  }
  const prodSource = await findProdBy(supabase, "source_url", sourceUrl);
  const prodTitle = await findProdBy(supabase, "title", title);
  return { localSource, localTitle, prodSource, prodTitle };
}

function decisionOf(located, title, sourceUrl) {
  const conflict = [located.localTitle, located.prodTitle].find((row) =>
    titleConflicts(row, title, sourceUrl)
  );
  if (conflict) return { action: "skip", pageId: conflict.id, preferredId: null };
  if (located.localSource && located.prodSource) {
    return { action: "skip", pageId: located.localSource.id, preferredId: null };
  }
  return {
    action: "import",
    pageId: located.localSource?.id || located.prodSource?.id || null,
    preferredId: located.localSource?.id || located.prodSource?.id || null,
  };
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
    const existing =
      findLocalBy(db, "source_url", page.sourceUrl) || findLocalBy(db, "title", page.title);
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

async function buildScale(libs) {
  const html = await fetchText(SCALE_URL);
  const markdown = scaleMarkdownFromHtml(html);
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertPage({
    markdown,
    content,
    stats,
    title: SCALE_TITLE,
    sourceUrl: SCALE_URL,
    phrases: SCALE_PHRASES,
    hrefs: SCALE_HREFS,
    expected: SCALE_EXPECTED,
    fence: "claude agents",
  });
  return { markdown, content, stats };
}

async function buildClone(libs) {
  const html = await inlineCloneImage(await fetchText(CLONE_URL));
  const markdown = cloneMarkdownFromHtml(html);
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertPage({
    markdown,
    content,
    stats,
    title: CLONE_TITLE,
    sourceUrl: CLONE_URL,
    phrases: CLONE_PHRASES,
    hrefs: CLONE_HREFS,
    expected: CLONE_EXPECTED,
    fence: "https://github.com/Jakeschincariol/replica-skill\n\ninstall skill",
  });
  return { markdown, content, stats };
}

const TARGETS = [
  {
    key: "agent-view",
    title: SCALE_TITLE,
    sourceUrl: SCALE_URL,
    build: buildScale,
  },
  {
    key: "replica",
    title: CLONE_TITLE,
    sourceUrl: CLONE_URL,
    build: buildClone,
  },
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
  const results = [];
  for (const target of TARGETS) {
    const before = decisionOf(
      await locate(supabase, target.title, target.sourceUrl),
      target.title,
      target.sourceUrl
    );
    if (!checkOnly && before.action === "skip") {
      results.push({
        key: target.key,
        action: "skip",
        title: target.title,
        pageId: before.pageId,
        path: `/pages/${before.pageId}`,
        sourceUrl: target.sourceUrl,
        fetched: false,
      });
      continue;
    }
    const built = await target.build(libs);
    const again = decisionOf(
      await locate(supabase, target.title, target.sourceUrl),
      target.title,
      target.sourceUrl
    );
    if (checkOnly) {
      results.push({
        key: target.key,
        action: again.action === "skip" ? "skip" : "check",
        title: target.title,
        sourceUrl: target.sourceUrl,
        images: built.stats.images,
        attachments: built.stats.attachments,
        tables: built.stats.tables,
        codes: built.stats.codes,
        hrefs: publicHrefs(built.stats.hrefs),
        hash: hashOf(built.content),
        length: built.content.length,
      });
      continue;
    }
    if (again.action === "skip") {
      results.push({
        key: target.key,
        action: "skip",
        title: target.title,
        pageId: again.pageId,
        path: `/pages/${again.pageId}`,
        sourceUrl: target.sourceUrl,
        fetched: true,
      });
      continue;
    }
    const saved = await persist(
      supabase,
      {
        title: target.title,
        content: built.content,
        sourceUrl: target.sourceUrl,
        preferredId: again.preferredId,
      },
      libs
    );
    const action = saved.localPages + saved.prodPages > 0 ? "insert" : "skip";
    results.push({
      key: target.key,
      action,
      title: target.title,
      pageId: saved.pageId,
      path: `/pages/${saved.pageId}`,
      sourceUrl: target.sourceUrl,
      images: built.stats.images,
      attachments: built.stats.attachments,
      tables: built.stats.tables,
      codes: built.stats.codes,
      hash: hashOf(built.content),
      length: built.content.length,
      createdAt: saved.createdAt,
      localPages: saved.localPages,
      prodPages: saved.prodPages,
      fetched: true,
    });
  }
  emit({ results });
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
