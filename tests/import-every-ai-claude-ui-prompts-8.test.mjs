// every._ai 클로드 UI 프롬프트 8가지 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  BODY_IMAGES,
  CODE_DOCS_URL,
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  PAGE_TITLE,
  PROMPT_DOCS_URL,
  SOURCE_URL,
  assertPngSignature,
  isDuplicateRow,
  parseEveryAiHtml,
  stripTracking,
} from "../scripts/import-every-ai-claude-ui-prompts-8.mjs";

const OTHER_TITLE = "클로드 코드로 앱 만드는 프롬프트 8가지";
const OTHER_URL =
  "https://every-ai-guides.vercel.app/posts/claude-code-app-prompts-8";
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PNG_BYTES_2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64"
);
const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;
const PNG_DATA_URL_2 = `data:image/png;base64,${PNG_BYTES_2.toString("base64")}`;

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-every-ai-claude-ui-prompts-8.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>클로드로 밤티 없는 화면 만드는 프롬프트 8가지 — every._ai</title>
  </head>
  <body>
    <nav>
      <a href="https://youtube.com/@every._ai">유튜브</a>
      <a href="https://instagram.com/every._ai?utm_source=nav">인스타그램</a>
    </nav>
    <article class="post">
      <div class="head">
        <div class="lbl">GUIDE · Claude Code</div>
        <h1><em>클로드로 밤티 없는 화면 만드는</em> 프롬프트 8가지</h1>
        <div class="sub"><span>읽는 데 8분</span><span>2026-10-04 공개</span></div>
      </div>
      <a class="bootcamp-post-banner" href="/class/bootcamp-oct.html?utm_source=every-ai-blog&amp;from=dm">
        <b>추석 AI 부트캠프</b>
        <img src="/img/class/claude-icon.png" alt="Claude">
      </a>
      <h2>Quick Start</h2>
      <p>밤티 없는 화면을 만드는 프롬프트다.</p>
      <h2><span class="n">STEP 1 · 1분</span>화면 톤을 정한다</h2>
      <div class="prompt">
        <div class="bar"><b>⚡ 01 · UI</b><button type="button">복사</button></div>
        <pre>밤티 없는 화면의 여백을 정해줘.</pre>
      </div>
      <table>
        <tr><th>단계</th><th>역할</th></tr>
        <tr><td>01</td><td>화면</td></tr>
      </table>
      <h2>실제로 돌려본 전후 화면</h2>
      <figure class="shot">
        <img src="${PNG_DATA_URL}" alt="${BODY_IMAGES[0].alt}">
        <figcaption>${BODY_IMAGES[0].alt}</figcaption>
      </figure>
      <figure class="shot">
        <img src="${PNG_DATA_URL_2}" alt="${BODY_IMAGES[1].alt}">
        <figcaption>${BODY_IMAGES[1].alt}</figcaption>
      </figure>
      <h2>공식 참고 자료</h2>
      <ul>
        <li><a href="${CODE_DOCS_URL}?utm_source=share&amp;from=dm">Claude Code 공식</a></li>
        <li><a href="${PROMPT_DOCS_URL}">Anthropic 공식</a></li>
      </ul>
      <script>/* 유입 표식 from=dm */</script>
    </article>
    <section class="challenge-banner">
      <form id="challenge-signup">
        <button type="submit">모집 소식 받기</button>
      </form>
    </section>
    <footer>
      <a href="https://instagram.com/every._ai">every</a>
      <a href="https://youtube.com/@every._ai?from=dm">유튜브</a>
    </footer>
    <script>/* 페이지 하단 유입 표식 from=dm */</script>
  </body>
</html>`;

function countNodes(node, type) {
  let count = node?.type === type ? 1 : 0;
  for (const child of node?.content ?? []) count += countNodes(child, type);
  return count;
}

function textNodes(node, acc = []) {
  if (node?.type === "text" && node.text) acc.push(node.text);
  for (const child of node?.content ?? []) textNodes(child, acc);
  return acc;
}

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// every._ai 클로드 UI 프롬프트 8가지를 Pages에만 저장한다"
  );
  assert.equal(source.includes("article.post"), true);
  assert.equal(source.includes("a.bootcamp-post-banner"), true);
  assert.equal(source.includes("section.challenge-banner"), true);
  assert.equal(source.includes('find("button")') || source.includes("button, script"), true);
  assert.equal(source.includes("EVIMG"), true);
  assert.equal(source.includes("protectDateLines"), false);
  assert.equal(source.includes("\\u200b"), false);
  assert.equal(source.includes("OG_IMAGE"), false);
  assert.equal(source.includes("BODY_IMAGE_BYTES"), false);
  assert.equal(source.includes("BODY_IMAGE_WIDTH"), false);
  assert.equal(source.includes("BODY_IMAGE_HEIGHT"), false);
  assert.equal(source.includes(OTHER_TITLE), false);
  assert.equal(source.includes(OTHER_URL), false);
});

test("PAGE_TITLE과 SOURCE_URL과 본문 이미지 두 장 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://every-ai-guides.vercel.app/posts/claude-ui-prompts-8"
  );
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(PAGE_TITLE, "클로드로 밤티 없는 화면 만드는 프롬프트 8가지");
  assert.equal(PAGE_TITLE.includes("every._ai"), false);
  assert.equal(PAGE_TITLE.includes("—"), false);
  assert.equal(BODY_IMAGES.length, 2);
  assert.deepEqual(BODY_IMAGES[0], {
    url: "https://every-ai-guides.vercel.app/img/p08-start-final-390.png",
    alt: "390px · 시작 화면과 08 최종 화면",
    bytes: 77292,
    width: 828,
    height: 895,
  });
  assert.deepEqual(BODY_IMAGES[1], {
    url: "https://every-ai-guides.vercel.app/img/p08-start-final-1440.png",
    alt: "1440px · 시작 화면과 08 최종 화면",
    bytes: 42308,
    width: 1488,
    height: 501,
  });
  assert.notEqual(BODY_IMAGES[0].bytes, BODY_IMAGES[1].bytes);
  assert.notEqual(BODY_IMAGES[0].width, BODY_IMAGES[1].width);
  assert.notEqual(BODY_IMAGES[0].height, BODY_IMAGES[1].height);
  assert.notEqual(BODY_IMAGES[0].url, BODY_IMAGES[1].url);
  assert.notEqual(BODY_IMAGES[0].alt, BODY_IMAGES[1].alt);
  assert.equal(EXPECTED_IMAGES, 2);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 3);
  assert.equal(EXPECTED_CODES, 8);
});

test("다른 글 제목과 URL이면 중복이 아니다", () => {
  assert.notEqual(PAGE_TITLE, OTHER_TITLE);
  assert.notEqual(SOURCE_URL, OTHER_URL);
  assert.equal(
    isDuplicateRow(
      { title: OTHER_TITLE, source_url: OTHER_URL, content: OTHER_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});

test("stripTracking은 utm과 from=dm을 뺀다", () => {
  const trackingKey = ["fb", "clid"].join("");
  const dirty = `${SOURCE_URL}?utm_source=share&${trackingKey}=x&from=dm`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes(trackingKey), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("from=dm"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("parseEveryAiHtml은 프롬프트와 공식 링크와 이미지 두 장을 남긴다", () => {
  const dirty = `${SOURCE_URL}/?utm_source=share&from=dm`;
  const parsed = parseEveryAiHtml(FIXTURE, dirty);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [every._ai](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("— every._ai"), false);
  assert.equal(parsed.markdown.includes("GUIDE · Claude Code"), true);
  assert.equal(parsed.markdown.includes("읽는 데 8분"), true);
  assert.equal(parsed.markdown.includes("2026-10-04 공개"), true);
  assert.equal(parsed.markdown.includes("Quick Start"), true);
  assert.equal(parsed.markdown.includes("STEP 1"), true);
  assert.equal(parsed.markdown.includes("밤티"), true);
  assert.equal(parsed.markdown.includes("실제로 돌려본 전후 화면"), true);
  assert.equal(parsed.markdown.includes("공식 참고 자료"), true);
  assert.match(parsed.markdown, /```\n밤티 없는 화면의 여백을 정해줘\./);
  assert.equal(parsed.markdown.includes("| 단계 | 역할 |"), true);
  assert.equal(parsed.markdown.includes("| 01 | 화면 |"), true);
  const firstImage = parsed.markdown.indexOf(
    `![${BODY_IMAGES[0].alt}](${PNG_DATA_URL})`
  );
  const secondImage = parsed.markdown.indexOf(
    `![${BODY_IMAGES[1].alt}](${PNG_DATA_URL_2})`
  );
  assert.equal(firstImage >= 0, true);
  assert.equal(secondImage > firstImage, true);
  assert.equal(parsed.markdown.includes("EVIMG"), false);
  assert.equal(parsed.markdown.includes(SOURCE_URL), true);
  assert.equal(parsed.markdown.includes(CODE_DOCS_URL), true);
  assert.equal(parsed.markdown.includes(PROMPT_DOCS_URL), true);
  const links = [
    ...parsed.markdown.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(links)].sort(),
    [CODE_DOCS_URL, PROMPT_DOCS_URL, SOURCE_URL].sort()
  );
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes("from=dm"), false);
  assert.equal(parsed.markdown.includes("부트캠프"), false);
  assert.equal(parsed.markdown.includes("추석"), false);
  assert.equal(parsed.markdown.includes("모집"), false);
  assert.equal(parsed.markdown.includes("유튜브"), false);
  assert.equal(parsed.markdown.includes("youtube.com"), false);
  assert.equal(parsed.markdown.includes("instagram.com/every"), false);
  assert.equal(parsed.markdown.includes("claude-icon"), false);
  assert.equal(parsed.markdown.includes("복사"), false);
  assert.equal(parsed.markdown.includes("\u200b"), false);
  const dateLine = parsed.markdown
    .split("\n")
    .find((line) => line.includes("2026-10-04"));
  assert.equal(Boolean(dateLine), true);
  assert.equal(/^\d+\.\s+/.test(dateLine), false);

  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  tsx.register({ tsconfig: resolve(repoRoot, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(repoRoot, "src/lib/markdown-to-tiptap.ts")
  );
  const doc = markdownToTiptapDoc(parsed.markdown);
  assert.equal(countNodes(doc, "codeBlock"), 1);
  assert.equal(countNodes(doc, "table"), 1);
  assert.equal(countNodes(doc, "image"), 2);
  assert.equal(textNodes(doc).some((text) => text.includes("2026-10-04")), true);
  assert.equal(JSON.stringify(doc).includes("\u200b"), false);
  const image = [];
  const visit = (node) => {
    if (node?.type === "image") image.push(node);
    for (const child of node?.content ?? []) visit(child);
  };
  visit(doc);
  assert.equal(image[0].attrs.src, PNG_DATA_URL);
  assert.equal(image[0].attrs.alt, BODY_IMAGES[0].alt);
  assert.equal(image[1].attrs.src, PNG_DATA_URL_2);
  assert.equal(image[1].attrs.alt, BODY_IMAGES[1].alt);
});

test("PNG 시그니처가 아니면 예외가 난다", () => {
  assertPngSignature(PNG_BYTES);
  assertPngSignature(PNG_BYTES_2);
  assert.equal(Buffer.from(PNG_BYTES.subarray(0, 4)).toString("hex"), "89504e47");
  assert.equal(Buffer.from(PNG_BYTES_2.subarray(0, 4)).toString("hex"), "89504e47");
  assert.throws(
    () => assertPngSignature(Buffer.from([0, 0, 0, 0])),
    /PNG 시그니처가 아닙니다/
  );
  const bad = FIXTURE.replace(
    PNG_DATA_URL,
    "data:image/png;base64,AAAA"
  );
  assert.throws(() => parseEveryAiHtml(bad), /PNG 시그니처가 아닙니다/);
});

test("isDuplicateRow는 제목 또는 원문 URL로 true다", () => {
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, content: "x" }, PAGE_TITLE, [SOURCE_URL]),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL, content: "없음" },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${SOURCE_URL}` },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, [SOURCE_URL]),
    false
  );
});

test("Prompts 저장과 기존 행 update가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(/UPDATE\s+custom_pages/i.test(source), false);
});
