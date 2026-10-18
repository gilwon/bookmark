// 챗GPT 코드 100개와 심팀장 REA 글 이관을 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CODES_TITLE,
  CODES_URL,
  REVERSE_TITLE,
  REVERSE_URL,
  codesMarkdownFromHtml,
  isDuplicateRow,
  reverseMarkdownFromHtml,
  stripTracking,
} from "../scripts/import-lazyowen-codes-reverse.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-lazyowen-codes-reverse.mjs"
);
const TRACKING_KEY = ["fb", "clid"].join("");
const PDF = "data:application/pdf;base64,JVBERg==";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

const CODES_HTML = `<!doctype html>
<html><body>
<nav class="nav"><a href="/challenge">30일 AI 챌린지</a></nav>
<article class="article">
  <aside class="guide-toc"><a href="#step">목차</a></aside>
  <div class="guide-reader">
    <header class="article-head">
      <h1>챗GPT 쓸 때 모르면 손해인 코드 100개</h1>
      <div class="article-meta">
        <span>2026-10-09 공개</span>
        <a class="guide-pdf" href="${PDF}">PDF</a>
      </div>
    </header>
    <div class="guide-gate-fading">
      <div class="prose">
        <nav><a href="#step">Quick Start</a></nav>
        <p>STEP 1. 코드 붙이는 공식 익히기</p>
        <img src="${PNG}" alt="코드 표 그림">
        <div class="composer__box">
          <div class="composer__text">코드: ELI5
<span class="slot">&lt;답에서 바꾸고 싶은 점 한 가지</span></div>
          <button type="button">복사</button>
        </div>
      </div>
    </div>
    <section class="guide-gate">
      <h3>이메일 하나면, 전부 무료입니다.</h3>
      <p>300만원 상당</p>
    </section>
    <div class="guide-gate-tail">
      <div class="prose">
        <p>STEP 5. 두 개 섞고 맥락 붙이기</p>
        <p>코드 100개 전체 목록</p>
        <p>100. NEXTSTEP</p>
        <a href="https://chatgpt.com/?${TRACKING_KEY}=abc&amp;utm_source=ig">chatgpt.com</a>
      </div>
      <aside class="guide-pdf"><a href="${PDF}">PDF 내려받기</a></aside>
      <div class="prose guide-ending">
        <a href="https://www.instagram.com/lazy_owen/">인스타</a>
        <a href="https://www.youtube.com/@lazyowenAI">유튜브</a>
      </div>
    </div>
  </div>
</article>
</body></html>`;

const REVERSE_HTML = `<!doctype html>
<html><head>
<meta property="og:image" content="https://shimteamjjang.vercel.app/og-reverse.png">
</head><body>
<div class="wrap">
  <header>
    <img src="${PNG}" alt="심팀장님 캐릭터">
    <h1>앱을 AI가 뜯어서<br><span class="hl">다시 만들어</span> 주는 무료 도구</h1>
    <p class="sub">설치 3단계 · 복붙 사용 문장 · 노션 사례 · 꼭 알아둘 것</p>
  </header>
  <div class="copywrap"><button class="copy">복사</button><pre>npx rea-agents setup</pre></div>
  <table class="tbl">
    <tr><th>무엇을 뜯나</th><th>따로 필요한 것</th></tr>
    <tr><td>웹사이트</td><td>크롬 계열 브라우저</td></tr>
  </table>
  <p><a href="https://github.com/morluto/rea">원문</a></p>
  <p><a href="https://rea.tools/showcase/notion/?${TRACKING_KEY}=1">노션 사례</a></p>
  <footer><p>참고: REA 저장소 README · 2026-10-13 확인.</p></footer>
</div>
<img src="https://shimteamjjang.vercel.app/og-reverse.png" alt="card">
</body></html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 게으른 빌더 챗GPT 코드 100개와 심팀장 REA 글을 Pages에만 저장한다."
  );
  assert.equal(source.includes(TRACKING_KEY), false);
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("이번 실행에서 넣은 로컬 행만 지운다. 원래 있던 행은 남긴다."), true);
});

test("원문 주소에는 쿼리가 없다", () => {
  assert.equal(CODES_URL.includes("?"), false);
  assert.equal(REVERSE_URL.includes("?"), false);
  assert.equal(CODES_URL.includes(TRACKING_KEY), false);
  assert.equal(REVERSE_URL.includes(TRACKING_KEY), false);
  const messy = `${CODES_URL}?${TRACKING_KEY}=abc&utm_source=ig&gclid=1&from=littly&from=dm&m=1&source=copy_link&pvs=1&igsh=1&mcp_token=1`;
  assert.equal(stripTracking(messy), CODES_URL);
  assert.equal(stripTracking("http://example.com/a"), "https://example.com/a");
  assert.equal(stripTracking("http://localhost/keep"), "http://localhost/keep");
  assert.equal(stripTracking("http://127.0.0.1/keep"), "http://127.0.0.1/keep");
  assert.equal(stripTracking(PDF), PDF);
});

test("같은 제목이나 같은 원문만 중복이다", () => {
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: "https://example.com/other" }, CODES_TITLE, [CODES_URL]),
    false
  );
  assert.equal(
    isDuplicateRow({ title: CODES_TITLE, source_url: "https://example.com/other" }, CODES_TITLE, [CODES_URL]),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: REVERSE_URL }, REVERSE_TITLE, [REVERSE_URL]),
    true
  );
});

test("코드 100개 변환은 이메일 벽과 유튜브를 빼고 PDF 두 개와 그림을 남긴다", () => {
  const markdown = codesMarkdownFromHtml(CODES_HTML);
  assert.equal(markdown.startsWith(`# ${CODES_TITLE}`), true);
  assert.equal(markdown.includes(CODES_URL), true);
  assert.equal(markdown.includes("이메일 하나면"), false);
  assert.equal(markdown.includes("30일 AI 챌린지"), false);
  assert.equal(markdown.includes("300만원"), false);
  assert.equal(markdown.includes("youtube.com"), false);
  assert.equal(markdown.includes("/challenge"), false);
  assert.equal(markdown.includes("#step"), false);
  assert.equal(/^복사$/m.test(markdown), false);
  assert.equal(markdown.split(PDF).length - 1, 2);
  assert.equal(markdown.includes("PDF 내려받기"), true);
  assert.equal(markdown.includes(PNG), true);
  assert.equal(markdown.includes("코드 표 그림"), true);
  assert.match(markdown, /```\n코드: ELI5\n<답에서 바꾸고 싶은 점 한 가지\n```/);
  assert.equal(markdown.includes("https://chatgpt.com/"), true);
  assert.equal(markdown.includes(TRACKING_KEY), false);
  assert.equal(markdown.includes("https://www.instagram.com/lazy_owen/"), true);
  assert.equal(markdown.includes("100. NEXTSTEP"), true);
  assert.equal(markdown.includes("2026-10-09 공개"), true);
});

test("REA 변환은 캐릭터 그림과 표와 설치 코드와 출처를 남기고 소셜 카드는 버린다", () => {
  const markdown = reverseMarkdownFromHtml(REVERSE_HTML);
  assert.equal(markdown.startsWith(`# ${REVERSE_TITLE}`), true);
  assert.equal(markdown.includes("다시만들어"), false);
  assert.equal(/^복사$/m.test(markdown), false);
  assert.equal(markdown.includes("og-reverse.png"), false);
  assert.equal(markdown.includes(PNG), true);
  assert.equal(markdown.includes("심팀장님 캐릭터"), true);
  assert.equal(markdown.includes("설치 3단계 · 복붙 사용 문장 · 노션 사례 · 꼭 알아둘 것"), true);
  assert.match(markdown, /\| 무엇을 뜯나 \| 따로 필요한 것 \|/);
  assert.match(markdown, /\| 웹사이트 \|/);
  assert.match(markdown, /```\nnpx rea-agents setup\n```/);
  assert.equal(markdown.includes("https://github.com/morluto/rea"), true);
  assert.equal(markdown.includes("https://rea.tools/showcase/notion/"), true);
  assert.equal(markdown.includes(TRACKING_KEY), false);
  assert.equal(markdown.includes("참고: REA 저장소 README"), true);
  assert.equal(markdown.includes("2026-10-13"), true);
  assert.equal(markdown.includes(REVERSE_URL), true);
});
