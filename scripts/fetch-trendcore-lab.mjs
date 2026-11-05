// 트렌드코어 스킬공유자료실 목록과 본문을 마크다운 JSON으로 추출한다.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guidesPath = resolve(root, "src/data/trendcore-lab.json");
const bodiesPath = resolve(root, "src/data/trendcore-lab-bodies.json");
const ORIGIN = "https://www.trendcore.co.kr";
const LAB_URL = `${ORIGIN}/lab`;
const EXPECTED_COUNT = 74;
const CATEGORY_WORDS = new Set(["정보", "꿀팁", "기초첫걸음", "가이드"]);
const DATE_PATTERN = /(\d{1,2})월\s*(\d{1,2})일/;

const FORBIDDEN_SNIPPETS = [
  "open.kakao.com",
  "SNS자동화 시스템 무료강의",
  "오픈톡에서 물어보세요",
  "utm_source",
  "fbclid",
  "studio.trendcore.co.kr/api/lab/hit",
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

function resolveLabUrl(value, pageUrl) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("mailto:")) return raw;
  return stripTracking(new URL(raw, pageUrl).href);
}

function sourceUrlFromHref(href) {
  if (/^https?:\/\//i.test(href)) return stripTracking(href);
  return stripTracking(`${ORIGIN}${href}`);
}

function slugFromHref(href) {
  const path = String(href).split("?")[0].split("#")[0];
  const parts = path.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] || "");
}

function publishedAtFrom(footer, slug) {
  const match = collapseText(footer).match(DATE_PATTERN);
  if (!match) throw new Error(`${slug} 카드에 월일이 없습니다.`);
  const month = String(Number(match[1])).padStart(2, "0");
  const day = String(Number(match[2])).padStart(2, "0");
  return `2026-${month}-${day}T00:00:00.000Z`;
}

function categoryFrom(footer, number, slug) {
  const text = collapseText(footer);
  if (text.includes("정보")) return "정보";
  if (text.includes("꿀팁")) return "꿀팁";
  if (number === "기초첫걸음" || number === "가이드") return number;
  throw new Error(`${slug} 분류를 정하지 못했습니다.`);
}

function isCategoryOnly(piece) {
  const words = piece.split(" ").filter(Boolean);
  return words.length > 0 && words.every((word) => CATEGORY_WORDS.has(word));
}

function tagsFrom(rawHeading, footer) {
  const heading = collapseText(rawHeading);
  const tags = [];
  if (heading.includes("NEW")) tags.push("NEW");
  if (heading.includes("지금 인기")) tags.push("지금 인기");
  for (const piece of collapseText(footer).split(" · ")) {
    const tag = piece.trim();
    if (!tag || DATE_PATTERN.test(tag) || isCategoryOnly(tag)) continue;
    tags.push(tag);
  }
  return tags;
}

/** 랩 목록의 a.card 중 /guide/만 문서 순서로 읽는다. 같은 href는 첫 카드만 남긴다. */
export function parseLabIndex(html) {
  const $ = cheerio.load(html);
  const guides = [];
  const seen = new Set();
  $("a.card").each((_, card) => {
    const href = $(card).attr("href") || "";
    if (!href.startsWith("/guide/")) return;
    if (seen.has(href)) return;
    seen.add(href);
    const slug = slugFromHref(href);
    const rawHeading = $(card).find("span.h").first().text();
    const footer = $(card).find("div.f").first().text();
    const number = collapseText(rawHeading.replaceAll("지금 인기", "").replaceAll("NEW", ""));
    guides.push({
      slug,
      title: collapseText($(card).find("b").first().text()),
      summary: collapseText($(card).find("p").first().text()),
      number,
      category: categoryFrom(footer, number, slug),
      tags: tagsFrom(rawHeading, footer),
      publishedAt: publishedAtFrom(footer, slug),
      sourceUrl: sourceUrlFromHref(href),
    });
  });
  return guides;
}

function skipSpace(source, index) {
  let cursor = index;
  while (source[cursor] === " " || source[cursor] === "\n" || source[cursor] === "\r" || source[cursor] === "\t") {
    cursor += 1;
  }
  return cursor;
}

function readQuoted(source, index) {
  const quote = source[index];
  if (quote !== "'" && quote !== '"' && quote !== "`") return null;
  let cursor = index + 1;
  let raw = "";
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\\") {
      raw += `\\${source[cursor + 1] ?? ""}`;
      cursor += 2;
      continue;
    }
    if (char === quote) return { raw, end: cursor + 1 };
    raw += char;
    cursor += 1;
  }
  return null;
}

function unescapeJsString(value) {
  return value.replace(/\\([nrt\\'"`])/g, (_, char) => {
    if (char === "n") return "\n";
    if (char === "r") return "\r";
    if (char === "t") return "\t";
    return char;
  });
}

function applyTopic(value) {
  return value.replaceAll("${topic}", "맛집");
}

/** 템플릿 대입과 choice 거짓 갈래만 읽는다. 페이지 스크립트는 실행하지 않는다. */
function parseAssignmentValue(source, index) {
  let cursor = skipSpace(source, index);
  if (source.startsWith("(choice ?", cursor) || source.startsWith("(choice?", cursor)) {
    const question = source.indexOf("?", cursor);
    if (question < 0) return null;
    cursor = skipSpace(source, question + 1);
    const truthy = readQuoted(source, cursor);
    if (!truthy) return null;
    cursor = skipSpace(source, truthy.end);
    if (source[cursor] !== ":") return null;
    cursor = skipSpace(source, cursor + 1);
    const falsy = readQuoted(source, cursor);
    if (!falsy) return null;
    cursor = skipSpace(source, falsy.end);
    if (source[cursor] !== ")") return null;
    cursor = skipSpace(source, cursor + 1);
    let value = unescapeJsString(falsy.raw);
    while (source[cursor] === "+") {
      cursor = skipSpace(source, cursor + 1);
      const rest = readQuoted(source, cursor);
      if (!rest) return null;
      value += unescapeJsString(rest.raw);
      cursor = skipSpace(source, rest.end);
    }
    return applyTopic(value);
  }
  if (source[cursor] === "`") {
    const template = readQuoted(source, cursor);
    if (!template) return null;
    return applyTopic(unescapeJsString(template.raw));
  }
  return null;
}

function fillEmptyPres($) {
  const assignments = new Map();
  $("script").each((_, script) => {
    if ($(script).attr("src")) return;
    const source = $(script).html() || "";
    const pattern = /\$\(\s*'([^']+)'\s*\)\.textContent\s*=\s*/g;
    for (const match of source.matchAll(pattern)) {
      const value = parseAssignmentValue(source, match.index + match[0].length);
      if (value == null) continue;
      assignments.set(match[1], value);
    }
  });
  $("pre").each((_, pre) => {
    if (collapseText($(pre).text())) return;
    const id = $(pre).attr("id");
    if (!id || !assignments.has(id)) return;
    $(pre).text(assignments.get(id));
  });
  $("pre").each((_, pre) => {
    if (collapseText($(pre).text())) return;
    const id = $(pre).attr("id") || "(id 없음)";
    throw new Error(`빈 pre를 채우지 못했습니다. ${id}`);
  });
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
            cells.push($table(cell).text().replace(/\s+/g, " ").replace(/\|/g, "\\|").trim());
          });
        if (cells.length) rows.push(cells);
      });
      if (!rows.length) return "";
      const divider = rows[0].map(() => "---");
      return `\n\n${[rows[0], divider, ...rows.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n")}\n\n`;
    },
  });
  return turndown;
}

function restoreCodeFences(markdown, codes) {
  return String(markdown).replace(/LABPRE(\d+)END/g, (_, index) => {
    const code = codes[Number(index)] ?? "";
    const fence = code.includes("```") ? "````" : "```";
    return `\n\n${fence}\n${code}\n${fence}\n\n`;
  });
}

function cleanMarkdown(markdown) {
  return String(markdown ?? "")
    .replace(/\\([\[\]\.])/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url))
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function forbiddenHit(markdown) {
  for (const phrase of FORBIDDEN_SNIPPETS) {
    if (markdown.includes(phrase)) return phrase;
  }
  return null;
}

/** 본문만 마크다운으로 바꾼다. 빈 pre는 스크립트 문자에서만 채운다. */
export function extractLabMarkdown(html, pageUrl) {
  const $ = cheerio.load(html);
  fillEmptyPres($);
  // 이미지 버튼을 먼저 벗기지 않으면 뒤의 button 제거가 그림을 같이 지운다.
  $("figure button.image-open").each((_, button) => {
    $(button).replaceWith($(button).contents());
  });
  const lead = collapseText($("p.lead").first().text());
  $("a.kko, a[href*='open.kakao.com'], section.toc, nav.toc, div.top, a.back, p.foot, script, button, svg, iframe, form").remove();

  let body = $("main div.body").first();
  if (!body.length) {
    // 050은 PDF 버튼과 질문이 div.body 밖에 있다. work30·kaltoe는 이 선택자에 안 걸린다.
    const sections = $(
      "main > section.start-here, main > section.prep, main > section.item, main > section.qa, main > a.btn[href], main > a.pdfdl[href]"
    ).toArray();
    const fallback = sections.length
      ? sections
      : $("main > section, main > details, main a.pdfdl, main > a.btn[href], div.sheet article").toArray();
    if (!fallback.length) throw new Error("본문 루트가 없습니다.");
    body = $("<div></div>");
    for (const section of fallback) body.append(section);
  }
  if (lead) {
    const leadNode = $("<p></p>");
    leadNode.text(lead);
    body.prepend(leadNode);
  }
  body.find(".subtitle, .en, h2 small, h3 small").each((_, node) => {
    $(node).prepend(" ");
  });
  body.find(".item-head").each((_, head) => {
    const item = $(head);
    const num = item.find(".num").first();
    if (!num.length) return;
    const label = collapseText(num.text());
    const heading = item.find("h2, h3").first();
    if (label && heading.length) heading.prepend(`${label}. `);
    num.remove();
  });
  body.find("img[src], source[src], a[href]").each((_, node) => {
    const attr = node.tagName === "a" ? "href" : "src";
    const value = $(node).attr(attr);
    if (!value) return;
    $(node).attr(attr, resolveLabUrl(value, pageUrl));
  });

  const codes = [];
  body.find("pre").each((_, pre) => {
    codes.push($(pre).text().replace(/\n$/, ""));
    $(pre).replaceWith(`<p>LABPRE${codes.length - 1}END</p>`);
  });
  const drafted = restoreCodeFences(createTurndown().turndown(body.html() || ""), codes);
  if (/LABPRE\d+END/.test(drafted)) throw new Error("코드 펜스 치환에 실패했습니다.");
  const cleaned = cleanMarkdown(drafted);
  if (!cleaned) throw new Error("본문이 비어 있습니다.");
  const hit = forbiddenHit(cleaned);
  if (hit) throw new Error(`본문에 금지 조각이 있습니다. ${hit}`);
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

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function main() {
  const guides = parseLabIndex(await fetchHtml(LAB_URL));
  if (guides.length !== EXPECTED_COUNT) {
    const first = guides[0]?.slug ?? "";
    const last = guides.at(-1)?.slug ?? "";
    throw new Error(`고유 카드가 74가 아닙니다. 실제 ${guides.length}개. 앞 ${first} 뒤 ${last}`);
  }
  const slugs = new Set();
  for (const guide of guides) {
    if (!guide.slug || slugs.has(guide.slug)) throw new Error(`슬러그가 비었거나 중복됩니다. ${guide.slug}`);
    slugs.add(guide.slug);
  }

  const failures = [];
  const markdowns = await mapLimit(guides, 4, async (guide, index) => {
    console.error(`${index + 1}/${guides.length} ${guide.slug}`);
    try {
      const markdown = extractLabMarkdown(await fetchHtml(guide.sourceUrl), guide.sourceUrl).trim();
      if (!markdown) throw new Error("본문이 비어 있습니다.");
      return markdown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${guide.slug}: ${message}`);
      return "";
    }
  });
  if (failures.length > 0) {
    throw new Error(`본문 추출에 실패했습니다.\n${failures.join("\n")}`);
  }

  const bodies = {};
  for (let index = 0; index < guides.length; index += 1) {
    bodies[guides[index].slug] = markdowns[index];
  }
  writeFileSync(guidesPath, `${JSON.stringify(guides, null, 2)}\n`);
  writeFileSync(bodiesPath, `${JSON.stringify(bodies, null, 2)}\n`);
}

function launchedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (launchedDirectly()) await main();
