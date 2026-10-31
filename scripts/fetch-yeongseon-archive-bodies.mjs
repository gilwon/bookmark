// 신영선 자료 아카이브 본문을 받아 정화해 JSON으로 저장한다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVE_ORIGIN = "https://yeongseon.kr/archive/";
const USER_AGENT = "bookmark-yeongseon-archive";
const CONCURRENCY = 4;
const RETRIES = 3;

const KEEP_TAGS = new Set([
  "A",
  "ABBR",
  "B",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DEL",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "I",
  "LI",
  "OL",
  "P",
  "PRE",
  "S",
  "STRONG",
  "SUB",
  "SUP",
  "TABLE",
  "TBODY",
  "TD",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL",
  "IMG",
]);

const DROP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "BUTTON"]);

const KEEP_ATTRS = {
  A: new Set(["href", "title", "rel", "target"]),
  IMG: new Set(["src", "alt", "title", "width", "height"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan"]),
  CODE: new Set(["class"]),
  PRE: new Set(["class"]),
};

function hasClass(el, name) {
  const value = el.getAttribute("class") ?? "";
  return value.split(/\s+/u).includes(name);
}

function youtubeId(src) {
  if (!/youtube(?:-nocookie)?\.com/i.test(src)) return "";
  const matched = src.match(/\/embed\/([\w-]{6,})/);
  return matched?.[1] ?? "";
}

function linkParagraph(document, href, image) {
  const paragraph = document.createElement("p");
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  anchor.setAttribute("target", "_blank");
  anchor.setAttribute("rel", "noopener noreferrer");
  if (image) {
    const img = document.createElement("img");
    img.setAttribute("src", image.src);
    img.setAttribute("alt", image.alt);
    anchor.appendChild(img);
  } else {
    anchor.textContent = href;
  }
  paragraph.appendChild(anchor);
  return paragraph;
}

function removeComments(node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 8) {
      child.remove();
      continue;
    }
    if (child.nodeType === 1) removeComments(child);
  }
}

function removeBoilerplate(article) {
  for (const el of Array.from(article.querySelectorAll("a.reading-back"))) el.remove();
  for (const el of Array.from(article.querySelectorAll("ul.chips"))) el.remove();
  // 직계 제목·요약·날짜만 뺀다. 본문 중간의 제목은 남긴다.
  for (const el of Array.from(article.children)) {
    if (el.tagName === "H1") {
      el.remove();
      continue;
    }
    if (el.tagName === "P" && (hasClass(el, "sum") || hasClass(el, "meta"))) el.remove();
  }
  for (const el of Array.from(article.querySelectorAll("aside.note"))) {
    const text = (el.textContent ?? "").trim();
    if (text.startsWith("10배 더 빠르게") || text.includes("이 글을 보는 분들께")) el.remove();
  }
  for (const el of Array.from(article.querySelectorAll("ol.steps"))) {
    if ((el.textContent ?? "").includes("릴스 영상을 저장")) el.remove();
  }
  for (const el of Array.from(article.querySelectorAll("aside.promo"))) el.remove();
  for (const el of Array.from(article.querySelectorAll("div.cta"))) el.remove();
}

function replaceIframes(document, article) {
  for (const frame of Array.from(article.querySelectorAll("iframe"))) {
    const src = frame.getAttribute("src") ?? "";
    const id = youtubeId(src);
    if (id) {
      frame.replaceWith(
        linkParagraph(document, `https://www.youtube.com/watch?v=${id}`, {
          src: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
          alt: "유튜브 영상",
        })
      );
      continue;
    }
    if (/^\s*https:\/\//i.test(src)) {
      frame.replaceWith(linkParagraph(document, src.trim(), null));
      continue;
    }
    frame.remove();
  }
}

function simplifyBookmarks(document, article) {
  for (const anchor of Array.from(article.querySelectorAll("a.bm"))) {
    const href = anchor.getAttribute("href") ?? "";
    const title = anchor.querySelector(".bm-t")?.textContent?.trim() || href;
    const paragraph = document.createElement("p");
    const link = document.createElement("a");
    if (href) link.setAttribute("href", href);
    link.textContent = title;
    paragraph.appendChild(link);
    anchor.replaceWith(paragraph);
  }
}

function rewriteImages(article) {
  for (const img of Array.from(article.querySelectorAll("img"))) {
    const src = (img.getAttribute("src") ?? "").trim();
    if (src.includes("favicon.ico")) {
      img.remove();
      continue;
    }
    if (!src) continue;
    if (/^\s*javascript:/i.test(src)) {
      img.removeAttribute("src");
      continue;
    }
    if (/^https?:\/\//i.test(src) || /^data:image\//i.test(src)) continue;
    try {
      const next = new URL(src, ARCHIVE_ORIGIN);
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        img.removeAttribute("src");
        continue;
      }
      img.setAttribute("src", next.href);
    } catch {
      img.removeAttribute("src");
    }
  }
}

function rewriteLinks(article) {
  for (const anchor of Array.from(article.querySelectorAll("a"))) {
    const href = anchor.getAttribute("href") ?? "";
    if (/^\s*(?:javascript|data):/i.test(href)) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("target");
      continue;
    }
    const hex = href.match(/(?:^|\/)([0-9a-f]{32})\.html/);
    if (hex) {
      anchor.setAttribute("href", `/yeongseon-archive/${hex[1]}`);
      anchor.removeAttribute("target");
      continue;
    }
    if (/^\s*https?:\/\//i.test(href)) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  }
}

function cleanAttrs(el) {
  const allowed = KEEP_ATTRS[el.tagName] ?? new Set();
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on") || name === "style" || name === "srcdoc" || !allowed.has(name)) {
      el.removeAttribute(attr.name);
    }
  }
}

function unwrapLoose(article) {
  // 안쪽부터 푼다. span은 클래스가 의미 없어서 태그를 남기지 않는다.
  const nodes = Array.from(article.querySelectorAll("*")).reverse();
  for (const el of nodes) {
    if (!el.parentNode) continue;
    const tag = el.tagName;
    if (DROP_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    if (!KEEP_TAGS.has(tag)) {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
      continue;
    }
    cleanAttrs(el);
  }
}

/** 원문 HTML 문서에서 정화된 본문만 돌려준다. article이 없으면 빈 문자열이다. */
export function extractYeongseonArticleBody(html) {
  if (typeof html !== "string" || html.trim() === "") return "";
  const { document } = parseHTML(html);
  const article = document.querySelector("article");
  if (!article) return "";
  removeComments(article);
  removeBoilerplate(article);
  replaceIframes(document, article);
  simplifyBookmarks(document, article);
  rewriteImages(article);
  rewriteLinks(article);
  unwrapLoose(article);
  return article.innerHTML.trim();
}

async function loadBody(id) {
  const url = `${ARCHIVE_ORIGIN}${id}.html`;
  let last = "알 수 없는 오류";
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = extractYeongseonArticleBody(await response.text());
      if (!body) throw new Error("빈 본문");
      return body;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      if (attempt < RETRIES) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 400 * (attempt + 1)));
      }
    }
  }
  throw new Error(last);
}

async function main() {
  const items = JSON.parse(readFileSync(resolve(root, "src/data/yeongseon-archive.json"), "utf8"));
  const ids = items.map((item) => item.id);
  const bodies = {};
  const failed = [];
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      const id = ids[index];
      try {
        bodies[id] = await loadBody(id);
      } catch (error) {
        failed.push(id);
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${id} ${message}`);
      }
      if ((index + 1) % 40 === 0) console.error(`${index + 1}편 처리`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  if (failed.length > 0 || ids.some((id) => !bodies[id])) {
    console.error(`본문을 받지 못했습니다. ${failed.length}건`);
    for (const id of failed) console.error(id);
    process.exit(1);
  }

  const ordered = {};
  for (const id of ids) ordered[id] = bodies[id];
  writeFileSync(
    resolve(root, "src/data/yeongseon-archive-bodies.json"),
    `${JSON.stringify(ordered, null, 2)}\n`
  );
  console.error(`${ids.length}편을 저장했습니다.`);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
