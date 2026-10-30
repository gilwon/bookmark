// Crawl4AI 안내 이관 스크립트의 주소와 본문 규칙을 확인한다.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_TITLE,
  REQUIRED_CODES,
  SOURCE_URL,
  isDuplicateRow,
  pageFromHtml,
  stripTracking,
} from "../scripts/import-reborn-crawl4.mjs";

const SCRIPT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/import-reborn-crawl4.mjs");

const FIXTURE = `<!doctype html><title>${PAGE_TITLE} | REBORN LABS</title>
<body>
<header class="top"><a href="https://rebornlabs.kr/skillpack?utm_source=landing&utm_medium=web&utm_campaign=skillpack">리본랩스 스킬팩</a></header>
<section class="hero">
  <h1>웹을 AI가 읽기 좋게<br>깨끗한 마크다운으로</h1>
  <p class="sub"><b>Crawl4AI</b> — 안내입니다.</p>
  <p class="sub"><span class="badge">Apache-2.0 오픈소스</span></p>
</section>
<section class="sec">
  <h2>이 도구가 하는 일</h2>
  <div class="cards"><div class="card"><span class="k">1. 깨끗한 마크다운</span><p>본문입니다.</p></div></div>
  <p><a class="btn" href="https://github.com/unclecode/crawl4ai">공식 저장소 열기</a></p>
</section>
<section class="sec">
  <h2>깔기</h2>
  <div class="cmd"><code>pip install -U crawl4ai<br>crawl4ai-setup<br>crawl4ai-doctor</code></div>
</section>
<section class="sec">
  <h2>서버</h2>
  <div class="cmd"><code>docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g -e CRAWL4AI_API_TOKEN=내토큰 unclecode/crawl4ai:latest</code></div>
  <div class="cmd"><code>claude mcp add --transport sse c4ai-sse http://localhost:11235/mcp/sse<br>claude mcp list</code></div>
</section>
<section class="bottom">
  <h2>스킬 48종</h2>
  <p><a href="https://rebornlabs.kr/skillpack?utm_source=landing&utm_medium=web&utm_campaign=crawl4">스킬팩 보기</a></p>
</section>
<script>리본랩스 스킬팩</script>
</body>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const first = readFileSync(SCRIPT_PATH, "utf8").split("\n")[0];
  assert.equal(first.startsWith("// "), true);
  assert.equal(/[가-힣]/.test(first), true);
});

test("저장 주소에 추적 쿼리가 없다", () => {
  assert.equal(SOURCE_URL, "https://rebornlabs.kr/crawl4");
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(
    stripTracking("https://rebornlabs.kr/skillpack?utm_source=landing&utm_medium=web&utm_campaign=crawl4&fbclid=IwAR"),
    "https://rebornlabs.kr/skillpack",
  );
  assert.equal(stripTracking("http://localhost:11235/mcp/sse"), "http://localhost:11235/mcp/sse");
  assert.equal(stripTracking("http://example.com/a"), "https://example.com/a");
});

test("본문은 명령과 링크만 남기고 상단 메뉴를 뺀다", () => {
  const markdown = pageFromHtml(FIXTURE);
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(markdown.includes("리본랩스 스킬팩"), false);
  assert.equal(markdown.includes("utm_"), false);
  assert.equal(markdown.includes("https://rebornlabs.kr/skillpack)"), true);
  assert.equal(markdown.includes("https://github.com/unclecode/crawl4ai"), true);
  assert.equal(markdown.includes("### 1. 깨끗한 마크다운"), true);
  for (const code of REQUIRED_CODES) assert.equal(markdown.includes(code), true);
  assert.equal(markdown.includes("http://localhost:11235/mcp/sse"), true);
  assert.equal(markdown.includes("https://localhost:11235"), false);
});

test("isDuplicateRow는 제목 또는 원문 주소만 본다", () => {
  assert.equal(isDuplicateRow({ title: PAGE_TITLE, source_url: "다른" }, PAGE_TITLE, [SOURCE_URL]), true);
  assert.equal(
    isDuplicateRow({ title: "다른", source_url: `${SOURCE_URL}?fbclid=IwAR` }, PAGE_TITLE, [SOURCE_URL]),
    true,
  );
  assert.equal(isDuplicateRow({ title: "다른", content: SOURCE_URL }, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(isDuplicateRow({ title: "다른", source_url: "" }, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(isDuplicateRow(null, PAGE_TITLE, [SOURCE_URL]), false);
});

test("스크립트는 Prompts 테이블과 행 갱신을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes(".update({"), false);
  assert.equal(source.includes(".upsert("), false);
  assert.equal(source.includes(".or("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("content LIKE"), false);
  assert.equal(source.includes("로컬과 운영 중 한쪽에만 글이 있습니다."), true);
});
