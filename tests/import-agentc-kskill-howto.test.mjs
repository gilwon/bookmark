// AI TREND 한국인 전용 AI 스킬 사용 안내 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  IMAGE_ALT,
  PAGE_TITLE,
  SOURCE_URL,
  isDuplicateRow,
  parseAgentcHtml,
  prepareAgentcFragment,
  stripTracking,
} from "../scripts/import-agentc-kskill-howto.mjs";

const OTHER_TITLE = "한국인 전용 AI 스킬 125개 설치 가이드";
const OTHER_URL =
  "https://app.notion.com/p/ef4b256827ac8250ac8001830bc891b4";
const CAPABILITIES = "https://claude.ai/settings/capabilities";
const NODEJS = "https://nodejs.org";
const REPO = "https://github.com/NomaDamas/k-skill";
const INSTAGRAM = "https://www.instagram.com/ai.trend.kr";
const INSTALL_ADD = "/plugin marketplace add NomaDamas/k-skill";
const INSTALL_USE = "/plugin install k-skill@k-skill";
const APP_PROMPT = `${REPO} 이거 보고 에어팟 프로 3 배송비 포함 최저가 찾아줘. 한국어로 답해줘`;
const TRACKER = "fb" + "clid";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-agentc-kskill-howto.mjs"
);
const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
tsx.register({ tsconfig: resolve(repoRoot, "tsconfig.json") });
const { markdownToTiptapDoc } = require(
  resolve(repoRoot, "src/lib/markdown-to-tiptap.ts")
);

function countOf(text, needle) {
  return String(text).split(needle).length - 1;
}

function countNodes(doc, type) {
  let count = 0;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === type) count += 1;
    for (const child of node.content ?? []) visit(child);
  };
  visit(doc);
  return count;
}

function imageNodes(doc) {
  const images = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") images.push(node);
    for (const child of node.content ?? []) visit(child);
  };
  visit(doc);
  return images;
}

const FIXTURE = `<!doctype html>
<html lang="ko">
  <body>
    <div class="page">
      <header>
        <div class="brand">AI TREND</div>
        <h1>한국인 전용 AI 스킬,<br>바로 쓰는 법</h1>
        <p class="lead">물어보면 최저가·항공권·재고까지 찾아주는 무료 스킬 125개입니다.</p>
      </header>
      <section id="choose">
        <h2>클로드, 어디서 쓰세요?</h2>
        <button type="button" data-pick="app">
          <span class="t">클로드 앱</span>
          <span class="d">채팅창에서 씁니다. 처음 한 번 설정이 필요해요</span>
        </button>
      </section>
      <nav class="jump">
        <a href="#start">시작하기</a>
        <a href="#five">오늘의 5개</a>
        <a href="#all">전체 125개</a>
        <a href="#help">막혔을 때</a>
      </nav>
      <section id="start">
        <h2>시작하기</h2>
        <div class="cmd"><code>${INSTALL_ADD}</code><button type="button" data-copy="${INSTALL_ADD}">복사</button></div>
        <div class="cmd"><code>${INSTALL_USE}</code><button type="button" data-copy="${INSTALL_USE}">복사</button></div>
        <p>클로드 설정 → 기능에서 '외부 네트워크 접속 허용'을 켜 주세요.</p>
        <p><a href="${CAPABILITIES}?mcp_token=drop&amp;utm_source=share&amp;${TRACKER}=drop">설정</a></p>
        <details>
          <summary>설치 없이 써볼 수도 있어요</summary>
          <div class="body">
            <div class="qt">${REPO}</div>
            <button type="button" data-copy="${REPO}">복사</button>
          </div>
        </details>
      </section>
      <section id="five">
        <h2>오늘의 5개</h2>
        <article class="card">
          <h3>배송비까지 더한 최저가</h3>
          <div class="qt">에어팟 프로 3 배송비 포함 최저가 찾아줘</div>
          <button type="button" data-copy-cc="에어팟 프로 3 배송비 포함 최저가 찾아줘" data-copy-app="${APP_PROMPT}">복사</button>
          <table>
            <thead><tr><th>판매처</th><th>실구매가</th><th>배송</th></tr></thead>
            <tbody><tr><td>G마켓</td><td>209,750원</td><td>무료</td></tr></tbody>
          </table>
        </article>
      </section>
      <section id="all">
        <h2>전체 125개</h2>
        <div class="cats"><button type="button" data-target="cat-0">이동·교통·여행<span>18</span></button></div>
        <div class="catpanel" id="cat-0">
          <p>이동·교통·여행<span>18개</span></p>
          <div class="skills"><span>철도 통합 시간표 조회</span><span>항공권 가격 조회</span></div>
        </div>
      </section>
      <section id="help">
        <h2>막혔을 때</h2>
        <details>
          <summary>'npx를 찾을 수 없다'고 나와요</summary>
          <div class="body"><a href="${NODEJS}">nodejs.org</a>에서 LTS를 설치합니다.</div>
        </details>
      </section>
      <footer>
        원본 <a href="${REPO}">github.com/NomaDamas/k-skill</a>
        인스타그램 <a href="${INSTAGRAM}/">@ai.trend.kr</a>
      </footer>
      <script>SHOULD_NOT_LEAK_SCRIPT</script>
    </div>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// AI TREND 한국인 전용 AI 스킬 사용 안내를 Pages에만 저장한다"
  );
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes(OTHER_TITLE), false);
  assert.equal(source.includes(OTHER_URL), false);
  assert.equal(source.includes("SOURCE_URL}?mcp_token"), false);
  assert.equal(source.includes("mcp_token=${"), false);
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://agentc.live/shared/g-709b8e755c010fa7/view"
  );
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(SOURCE_URL.includes("mcp_token"), false);
  assert.equal(SOURCE_URL.includes(TRACKER), false);
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(PAGE_TITLE, "한국인 전용 AI 스킬, 바로 쓰는 법");
  assert.equal(
    IMAGE_ALT,
    "클로드 설정 화면. ① 기능 ② 외부 네트워크 접속 허용 켜기 ③ 도메인 허용 목록 모든 도메인"
  );
  assert.equal(EXPECTED_IMAGES, 1);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 5);
  assert.equal(EXPECTED_CODES, 7);
});

test("노션 125개 설치 가이드와 제목·URL이 다르다", () => {
  assert.notEqual(PAGE_TITLE, OTHER_TITLE);
  assert.notEqual(SOURCE_URL, OTHER_URL);
});

test("stripTracking은 mcp_token과 utm과 추적 클릭 키를 뺀다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&mcp_token=drop&${TRACKER}=drop`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned, SOURCE_URL);
  assert.equal(cleaned.includes("mcp_token"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes(TRACKER), false);
});

test("parseAgentcHtml은 프롬프트·설치 명령·표·공식 링크를 남긴다", () => {
  const dirty = `${SOURCE_URL}/?utm_source=share&mcp_token=drop&${TRACKER}=drop`;
  const prepared = prepareAgentcFragment(FIXTURE, dirty);
  assert.equal(prepared.fragment.includes("<button"), false);
  assert.equal(prepared.fragment.includes("<details"), false);
  assert.equal(prepared.fragment.includes("<script"), false);
  assert.equal(prepared.fragment.includes("#start"), false);
  assert.equal(prepared.fragment.includes("#five"), false);
  assert.equal(prepared.fragment.includes("mcp_token"), false);
  assert.equal(prepared.fragment.includes(TRACKER), false);
  assert.equal(prepared.fragment.includes("SHOULD_NOT_LEAK_SCRIPT"), false);
  const parsed = parseAgentcHtml(FIXTURE, dirty);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(parsed.markdown.includes("<br>"), false);
  assert.equal(
    parsed.markdown.includes(`> 원문. [AI TREND](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("오늘의 5개"), true);
  assert.equal(parsed.markdown.includes("전체 125개"), true);
  assert.equal(parsed.markdown.includes("배송비까지 더한 최저가"), true);
  assert.equal(parsed.markdown.includes("외부 네트워크 접속 허용"), true);
  assert.equal(parsed.markdown.includes("철도 통합 시간표 조회"), true);
  assert.equal(parsed.markdown.includes("항공권 가격 조회"), true);
  assert.equal(parsed.markdown.includes("채팅창에서 씁니다"), true);
  assert.equal(parsed.markdown.includes("### 설치 없이 써볼 수도 있어요"), true);
  assert.equal(parsed.markdown.includes("### 'npx를 찾을 수 없다'고 나와요"), true);
  assert.equal(countOf(parsed.markdown, INSTALL_ADD), 1);
  assert.equal(countOf(parsed.markdown, INSTALL_USE), 1);
  assert.equal(countOf(parsed.markdown, APP_PROMPT), 1);
  assert.equal(parsed.markdown.includes(CAPABILITIES), true);
  assert.equal(parsed.markdown.includes(`${CAPABILITIES}?`), false);
  assert.equal(parsed.markdown.includes(NODEJS), true);
  assert.equal(parsed.markdown.includes(REPO), true);
  assert.equal(parsed.markdown.includes(INSTAGRAM), true);
  assert.equal(parsed.markdown.includes("| 판매처 | 실구매가 | 배송 |"), true);
  assert.equal(parsed.markdown.includes("209,750원"), true);
  assert.equal(parsed.markdown.includes("mcp_token"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes(TRACKER), false);
  assert.equal(parsed.markdown.includes("eyJwaWQi"), false);
  assert.equal(parsed.markdown.includes("SHOULD_NOT_LEAK_SCRIPT"), false);
  assert.equal(parsed.markdown.includes("#start"), false);
  const doc = markdownToTiptapDoc(parsed.markdown);
  assert.equal(countNodes(doc, "codeBlock"), 3);
  assert.equal(countNodes(doc, "table"), 1);
  assert.equal(countNodes(doc, "image"), 0);
});

test("JPEG data URL은 자리표시로 바꿨다가 한 줄 이미지로 되돌린다", () => {
  const src = `data:image/jpeg;base64,${Buffer.from(
    Uint8Array.from([0xff, 0xd8, 0xff])
  ).toString("base64")}`;
  const html = `<div class="page">
    <h1>한국인 전용 AI 스킬,<br>바로 쓰는 법</h1>
    <ol class="steps">
      <li>
        <details class="shot">
          <summary>실제 설정 화면 보기</summary>
          <div class="body"><img alt="${IMAGE_ALT}" src="${src}"></div>
        </details>
      </li>
    </ol>
  </div>`;
  const prepared = prepareAgentcFragment(html);
  assert.equal(prepared.parked.length, 1);
  assert.equal(prepared.parked[0].src, src);
  assert.equal(prepared.parked[0].alt, IMAGE_ALT);
  assert.equal(prepared.fragment.includes(prepared.parked[0].token), true);
  assert.equal(prepared.fragment.includes("base64"), false);
  assert.equal(prepared.fragment.includes("<details"), false);
  assert.equal(prepared.fragment.includes("<img"), false);
  const parsed = parseAgentcHtml(html);
  assert.equal(parsed.markdown.includes(prepared.parked[0].token), false);
  const imageLine = parsed.markdown
    .split("\n")
    .find((line) => line.includes("data:image/jpeg"));
  assert.equal(imageLine, `![${IMAGE_ALT}](${src})`);
  const images = imageNodes(markdownToTiptapDoc(parsed.markdown));
  assert.equal(images.length, 1);
  assert.equal(images[0].attrs?.src, src);
  assert.equal(images[0].attrs?.alt, IMAGE_ALT);
});

test("JPEG 시그니처가 아니면 거절한다", () => {
  const src = `data:image/jpeg;base64,${Buffer.from(
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
  ).toString("base64")}`;
  const html = `<div class="page"><img alt="x" src="${src}"></div>`;
  assert.throws(() => parseAgentcHtml(html), /JPEG 시그니처/);
});

test("isDuplicateRow는 이 글의 제목 또는 원문 URL로만 true다", () => {
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
  assert.equal(
    isDuplicateRow(
      { title: OTHER_TITLE, source_url: OTHER_URL, content: OTHER_TITLE },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});
