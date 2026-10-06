// every._ai 클로드 코드 앱 프롬프트 8가지 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  BODY_IMAGE_ALT,
  BODY_IMAGE_BYTES,
  BODY_IMAGE_HEIGHT,
  BODY_IMAGE_URL,
  BODY_IMAGE_WIDTH,
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
} from "../scripts/import-every-ai-claude-code-app-prompts-8.mjs";

const OTHER_TITLE = "클로덱스 루프: 짠 모델이 자기 계획을 검수하지 못하게 막기";
const OTHER_URL =
  "https://sdk-kim-builds.com/guides/claudex-loop-cross-model-plan-review";
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-every-ai-claude-code-app-prompts-8.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>클로드 코드로 앱 만드는 프롬프트 8가지 — every._ai</title>
  </head>
  <body>
    <nav>
      <a href="https://youtube.com/@every._ai">유튜브</a>
      <a href="https://instagram.com/every._ai?utm_source=nav">인스타그램</a>
    </nav>
    <article class="post">
      <div class="head">
        <div class="lbl">GUIDE · Claude Code</div>
        <h1><em>클로드 코드로 앱 만드는</em> 프롬프트 8가지</h1>
        <div class="sub"><span>읽는 데 8분</span><span>2026-10-04 공개</span></div>
      </div>
      <a class="bootcamp-post-banner" href="/class/bootcamp-oct.html?utm_source=every-ai-blog&amp;from=dm&amp;fbclid=IwAR111">
        <b>추석 AI 부트캠프</b>
        <img src="/img/class/claude-icon.png" alt="Claude">
      </a>
      <h2>Quick Start</h2>
      <p>오늘셋은 오늘 끝낼 일을 고르는 앱이다.</p>
      <h2><span class="n">STEP 1 · 1분</span>핵심 기능과 완료 조건을 정한다</h2>
      <div class="prompt">
        <div class="bar"><b>⚡ 01 · Scope Planner</b><button type="button">복사</button></div>
        <pre>Scope Planner 역할을 맡아줘. [앱 이름]을 만들 거야.</pre>
      </div>
      <table>
        <tr><th>단계</th><th>역할</th></tr>
        <tr><td>01</td><td>Scope Planner</td></tr>
      </table>
      <figure class="shot">
        <img src="${PNG_DATA_URL}" alt="${BODY_IMAGE_ALT}">
        <figcaption>${BODY_IMAGE_ALT}</figcaption>
      </figure>
      <h2>공식 참고 자료</h2>
      <ul>
        <li><a href="${CODE_DOCS_URL}?fbclid=IwAR123&amp;utm_source=share">Claude Code 공식</a></li>
        <li><a href="${PROMPT_DOCS_URL}">Anthropic 공식</a></li>
      </ul>
      <script>var from = "from=dm";</script>
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
    "// every._ai 클로드 코드 앱 프롬프트 8가지를 Pages에만 저장한다"
  );
  assert.equal(source.includes("article.post"), true);
  assert.equal(source.includes("a.bootcamp-post-banner"), true);
  assert.equal(source.includes("section.challenge-banner"), true);
  assert.equal(source.includes('find("button")') || source.includes("button, script"), true);
  assert.equal(source.includes("EVIMG"), true);
  assert.equal(source.includes("protectDateLines"), false);
  assert.equal(source.includes("\\u200b"), false);
  assert.equal(source.includes("OG_IMAGE"), false);
  assert.equal(source.includes(OTHER_TITLE), false);
  assert.equal(source.includes(OTHER_URL), false);
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://every-ai-guides.vercel.app/posts/claude-code-app-prompts-8"
  );
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(PAGE_TITLE, "클로드 코드로 앱 만드는 프롬프트 8가지");
  assert.equal(PAGE_TITLE.includes("every._ai"), false);
  assert.equal(PAGE_TITLE.includes("—"), false);
  assert.equal(
    BODY_IMAGE_URL,
    "https://every-ai-guides.vercel.app/img/p07-todayset-390.png"
  );
  assert.equal(BODY_IMAGE_BYTES, 32448);
  assert.equal(BODY_IMAGE_WIDTH, 780);
  assert.equal(BODY_IMAGE_HEIGHT, 1688);
  assert.equal(BODY_IMAGE_ALT, "오늘셋 실제 실행 화면 · 390px · 목록과 완료 표시");
  assert.equal(EXPECTED_IMAGES, 1);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 2);
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

test("stripTracking은 utm, fbclid, from=dm을 뺀다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123&from=dm`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("from=dm"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("parseEveryAiHtml은 프롬프트와 공식 링크와 이미지를 남긴다", () => {
  const dirty = `${SOURCE_URL}/?utm_source=share&fbclid=IwAR123&from=dm`;
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
  assert.equal(parsed.markdown.includes("오늘셋"), true);
  assert.equal(parsed.markdown.includes("공식 참고 자료"), true);
  assert.equal(parsed.markdown.includes("Scope Planner"), true);
  assert.match(parsed.markdown, /```\nScope Planner 역할을 맡아줘\. \[앱 이름\]/);
  assert.equal(parsed.markdown.includes("| 단계 | 역할 |"), true);
  assert.equal(parsed.markdown.includes("| 01 | Scope Planner |"), true);
  assert.equal(
    parsed.markdown.includes(`![${BODY_IMAGE_ALT}](${PNG_DATA_URL})`),
    true
  );
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
  assert.equal(countNodes(doc, "image"), 1);
  assert.equal(textNodes(doc).some((text) => text.includes("2026-10-04")), true);
  assert.equal(JSON.stringify(doc).includes("\u200b"), false);
  const image = [];
  const visit = (node) => {
    if (node?.type === "image") image.push(node);
    for (const child of node?.content ?? []) visit(child);
  };
  visit(doc);
  assert.equal(image[0].attrs.src, PNG_DATA_URL);
  assert.equal(image[0].attrs.alt, BODY_IMAGE_ALT);
});

test("PNG 시그니처가 아니면 예외가 난다", () => {
  assertPngSignature(PNG_BYTES);
  assert.equal(Buffer.from(PNG_BYTES.subarray(0, 4)).toString("hex"), "89504e47");
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
