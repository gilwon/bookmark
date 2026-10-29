// 심팀장 자료실 홈 카드와 글 본문을 마크다운 JSON으로 추출한다.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guidesPath = resolve(root, "src/data/shim-guides.json");
const bodiesPath = resolve(root, "src/data/shim-guide-bodies.json");
const ORIGIN = "https://shimteamjjang.vercel.app";
const HOME_URL = `${ORIGIN}/`;

const FORBIDDEN_SNIPPETS = [
  "fbclid",
  "utm_source",
  "og-home.png",
  "og-clone.png",
  "og-reverse.png",
  "og-weekend.png",
];

function collapseText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === "fbclid" ||
    key === "gclid" ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1")
  );
}

function decodePart(value) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/** 추적 쿼리만 빼고 localhost가 아닌 http는 https로 올린다. 경로 글자는 다시 인코딩하지 않는다. */
function stripTracking(url) {
  const raw = String(url ?? "");
  if (!raw || raw.startsWith("data:") || raw.startsWith("mailto:")) return raw;
  const hashIndex = raw.indexOf("#");
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : "";
  const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";
  const kept = [];
  if (query) {
    for (const part of query.split("&")) {
      if (!part) continue;
      const eq = part.indexOf("=");
      const key = decodePart(eq >= 0 ? part.slice(0, eq) : part);
      const value = eq >= 0 ? decodePart(part.slice(eq + 1)) : "";
      if (isTrackingParam(key, value)) continue;
      kept.push(part);
    }
  }
  let result = path;
  if (kept.length > 0) result += `?${kept.join("&")}`;
  result += hash;
  const hostMatch = result.match(/^http:\/\/([^/?#]+)/i);
  if (hostMatch) {
    const host = hostMatch[1].split(":")[0].toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1") {
      result = result.replace(/^http:\/\//i, "https://");
    }
  }
  return result;
}

function slugFromSource(sourceUrl) {
  const match = String(sourceUrl).match(/^https?:\/\/[^/]+\/([^?#]*)/i);
  const path = match ? match[1].replace(/\/+$/, "") : "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

/** 슬래시로 시작하지 않는 주소는 문서 슬러그 폴더에 붙인다. new URL은 마지막 조각을 바꿔 404가 된다. */
function resolveAsset(src, sourceUrl) {
  const value = String(src ?? "").trim();
  if (!value || value.startsWith("data:") || value.startsWith("mailto:")) return value;
  if (/^https?:\/\//i.test(value)) return stripTracking(value);
  if (value.startsWith("//")) return stripTracking(`https:${value}`);
  if (value.startsWith("/")) return stripTracking(`${ORIGIN}${value}`);
  const slug = slugFromSource(sourceUrl);
  const relative = value.replace(/^\.\//, "");
  return stripTracking(`${ORIGIN}/${slug}/${relative}`);
}

function cleanAlt(value) {
  return String(value ?? "").replace(/\]/g, "").replace(/[\r\n]+/g, "");
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

function cleanMarkdown(markdown) {
  return String(markdown ?? "")
    .replace(/\\([\[\]\.])/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function restoreCodeFences(markdown, codes) {
  return String(markdown).replace(/SHIMPRE(\d+)END/g, (_, index) => {
    const code = codes[Number(index)] ?? "";
    const fence = code.includes("```") ? "````" : "```";
    return `\n\n${fence}\n${code}\n${fence}\n\n`;
  });
}

/** 홈 HTML의 a.card만 문서 순서로 읽는다. 외부 링크와 홈은 카드가 아니다. */
export function parseShimIndex(html) {
  const $ = cheerio.load(html);
  const items = [];
  $("a.card").each((_, card) => {
    const href = $(card).attr("href") || "";
    if (!href.startsWith("/") || href.startsWith("//")) return;
    const path = href.split("?")[0].split("#")[0];
    if (path === "/") return;
    const slug = path.replace(/^\/+|\/+$/g, "");
    if (!slug || slug.includes("/")) return;
    items.push({
      slug,
      title: collapseText($(card).find("p.t").first().text()),
      episode: collapseText($(card).find("span.ep").first().text()),
      summary: collapseText($(card).find("p.d").first().text()),
      order: items.length,
      sourceUrl: `${ORIGIN}/${slug}`,
    });
  });
  return items;
}

/** .wrap만 마크다운으로 바꾼다. 복사 버튼은 빼고 pre 글은 코드 펜스로 남긴다. */
export function extractShimMarkdown(html, sourceUrl) {
  const $ = cheerio.load(html);
  const wrap = $(".wrap").first();
  if (!wrap.length) throw new Error(".wrap이 없습니다.");
  wrap.find("script, style, noscript, button").remove();
  wrap.find("h1 br").replaceWith(" ");
  wrap.find("img").each((_, image) => {
    const src = $(image).attr("src");
    $(image).attr("alt", cleanAlt($(image).attr("alt")));
    if (!src) return;
    $(image).attr("src", resolveAsset(src, sourceUrl));
  });
  wrap.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", resolveAsset(href, sourceUrl));
  });
  const codes = [];
  wrap.find("pre").each((index, pre) => {
    codes.push($(pre).text().replace(/\n$/, ""));
    $(pre).replaceWith(`<p>SHIMPRE${index}END</p>`);
  });
  const drafted = restoreCodeFences(createTurndown().turndown(wrap.html() || ""), codes);
  if (/SHIMPRE\d+END/.test(drafted)) throw new Error("코드 펜스 치환에 실패했습니다.");
  const cleaned = cleanMarkdown(drafted);
  if (/og-[^)\s"']+\.png/.test(cleaned)) {
    throw new Error("og 카드 이미지는 본문이 아닙니다.");
  }
  return cleaned;
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

function forbiddenHit(markdown) {
  if (/og-[^)\s"']+\.png/.test(markdown)) return "og 카드 이미지";
  for (const phrase of FORBIDDEN_SNIPPETS) {
    if (markdown.includes(phrase)) return phrase;
  }
  return null;
}

async function main() {
  const guides = parseShimIndex(await fetchHtml(HOME_URL));
  if (guides.length !== 52) {
    throw new Error(`카드가 52건이 아닙니다. 받은 카드는 ${guides.length}건입니다.`);
  }
  const bodies = {};
  for (let index = 0; index < guides.length; index += 1) {
    if (index > 0) await pause(200);
    const guide = guides[index];
    console.error(`${index + 1}/52 ${guide.slug}`);
    const markdown = extractShimMarkdown(await fetchHtml(guide.sourceUrl), guide.sourceUrl).trim();
    if (!markdown) throw new Error(`${guide.slug} 본문이 비어 있습니다.`);
    const hit = forbiddenHit(markdown);
    if (hit) throw new Error(`${guide.slug} 본문에 금지 구절이 있습니다. ${hit}`);
    bodies[guide.slug] = markdown;
  }
  const ordered = {};
  for (const guide of guides) ordered[guide.slug] = bodies[guide.slug];
  writeFileSync(guidesPath, `${JSON.stringify(guides, null, 2)}\n`);
  writeFileSync(bodiesPath, `${JSON.stringify(ordered, null, 2)}\n`);
}

function launchedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (launchedDirectly()) await main();
