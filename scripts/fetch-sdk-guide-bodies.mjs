// 김스듴 가이드 원문에서 본문 마크다운을 추출해 저장한다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guidesPath = resolve(root, "src/data/sdk-guides.json");
const bodiesPath = resolve(root, "src/data/sdk-guide-bodies.json");

const REMOVE_SELECTOR = [
  "script",
  "style",
  "noscript",
  "button",
  "form",
  "details.guide-mail",
  "details.guide-toc",
  "aside.guide-mid-cta",
  "aside.guide-waitlist",
  ".guide-waitlist",
  "section.guide-inquiry-block",
  "nav.guide-next",
  "aside.guide-subscribe",
].join(", ");

const FORBIDDEN_SNIPPETS = [
  "지금 다 못 읽겠다면",
  "개인정보 수집",
  "이메일 알림 받기",
  "FOR TEAMS",
  "도입 상담 요청",
  "챌린지 오픈 알림",
  "https://sdk-kim-builds.com/privacy",
  "utm_source",
  "fbclid",
];

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

/** 유입 추적 쿼리를 빼고 절대 주소로 바꾼다. http 주소는 http로 둔다. */
function stripTracking(url, base) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) {
    return url;
  }
  try {
    const parsed = new URL(url, base);
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (isTrackingParam(key, value)) parsed.searchParams.delete(key);
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
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

/** 연월일 줄이 순서 목록으로 잘리지 않게 앞에 폭 없는 문자를 둔다. */
function protectDateLines(markdown) {
  return String(markdown).replace(/^(?=20\d{2}\.\s+\d{1,2}\.\s+\d{1,2}\.)/gm, "\u200b");
}

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
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
              $table(cell).text().replace(/\s+/g, " ").replace(/\|/g, "\\|").trim()
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

function flattenCodeLines($, scope) {
  scope.find("pre").each((_, pre) => {
    const lines = $(pre).find("span.line");
    if (!lines.length) return;
    const text = lines.toArray().map((line) => $(line).text()).join("\n");
    const current = $(pre).children("code").first();
    const language = current.attr("class") || "";
    $(pre).empty();
    const code = $("<code></code>");
    if (language) code.attr("class", language);
    code.text(text);
    $(pre).append(code);
  });
}

function rewriteUrls($, scope, sourceUrl) {
  scope.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:") || href.startsWith("mailto:")) return;
    $(link).attr("href", stripTracking(href, sourceUrl));
  });
  scope.find("img[src]").each((_, image) => {
    const src = $(image).attr("src");
    if (!src || src.startsWith("data:") || src.startsWith("mailto:")) return;
    $(image).attr("src", stripTracking(src, sourceUrl));
  });
}

function cleanMarkdown(markdown, sourceUrl) {
  return protectDateLines(
    String(markdown ?? "")
      .replace(/\\([\[\]\.])/g, "$1")
      .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTracking(path, sourceUrl)})`)
      .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url, sourceUrl))
      .replace(/\n{3,}/g, "\n\n")
  ).trim();
}

/** 가이드 HTML에서 guide-detail-body만 마크다운으로 바꾼다. */
export function extractGuideMarkdown(html, sourceUrl) {
  const $ = cheerio.load(html);
  const body = $(".guide-detail-body").first();
  if (!body.length) throw new Error("guide-detail-body가 없습니다.");
  body.find(REMOVE_SELECTOR).remove();
  flattenCodeLines($, body);
  rewriteUrls($, body, sourceUrl);
  return cleanMarkdown(createTurndown().turndown(body.html() || ""), sourceUrl);
}

function forbiddenHit(markdown) {
  for (const phrase of FORBIDDEN_SNIPPETS) {
    const index = markdown.indexOf(phrase);
    if (index === -1) continue;
    const start = Math.max(0, index - 80);
    const end = Math.min(markdown.length, index + phrase.length + 80);
    return { phrase, around: markdown.slice(start, end) };
  }
  return null;
}

function pause(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function fetchHtml(url) {
  let lastError = new Error("원문을 받지 못했습니다.");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
      });
      if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 2) await pause(200);
    }
  }
  throw lastError;
}

async function main() {
  const guides = JSON.parse(readFileSync(guidesPath, "utf8"));
  if (!Array.isArray(guides) || guides.length !== 71) {
    throw new Error(`가이드 목록이 71건이 아닙니다.`);
  }
  const bodies = {};
  const failures = [];
  for (let index = 0; index < guides.length; index += 1) {
    if (index > 0) await pause(200);
    const guide = guides[index];
    try {
      const html = await fetchHtml(guide.sourceUrl);
      const markdown = extractGuideMarkdown(html, guide.sourceUrl).trim();
      if (!markdown) throw new Error("본문이 비어 있습니다.");
      const hit = forbiddenHit(markdown);
      if (hit) {
        failures.push({ slug: guide.slug, phrase: hit.phrase, around: hit.around });
        continue;
      }
      bodies[guide.slug] = markdown;
    } catch (error) {
      failures.push({
        slug: guide.slug,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (failures.length > 0 || Object.keys(bodies).length !== guides.length) {
    for (const failure of failures) console.error(JSON.stringify(failure));
    throw new Error(`본문 추출에 실패해 파일을 쓰지 않습니다. ${failures.length}건`);
  }
  const ordered = {};
  for (const guide of guides) ordered[guide.slug] = bodies[guide.slug];
  writeFileSync(bodiesPath, `${JSON.stringify(ordered, null, 2)}\n`);
}

// 테스트가 이 모듈을 가져올 때는 네트워크를 타지 않는다.
function launchedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (launchedDirectly()) await main();
