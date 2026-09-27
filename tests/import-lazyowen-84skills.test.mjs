// 게으른 빌더 다섯 부서 클로드 스킬 가이드 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PAGE_TITLE as AGENCY_TITLE,
  SOURCE_URL as AGENCY_URL,
} from "../scripts/import-lazyowen-agency-agents-7seats.mjs";
import {
  IMAGE_NAMES,
  PAGE_TITLE,
  SOURCE_URL,
  hasNoExpiredUrl,
  isDuplicateRow,
  parseLazyowenHtml,
  stripTracking,
} from "../scripts/import-lazyowen-84skills.mjs";
import {
  PAGE_TITLE as YOUTUBE_TITLE,
  SOURCE_URL as YOUTUBE_URL,
} from "../scripts/import-lazyowen-claude-youtube-skill.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-lazyowen-84skills.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>무료 클로드 스킬로 다섯 부서 채우기 · 게으른 빌더</title>
  </head>
  <body>
    <nav class="nav"><a href="/challenge">30일 AI 챌린지</a></nav>
    <aside class="chband" aria-label="30일 AI 챌린지 사전 등록">
      <span class="kicker">사전 등록 오픈</span>
    </aside>
    <article class="article">
      <header class="article-head">
        <h1>무료 클로드 스킬로 다섯 부서 채우기</h1>
      </header>
      <div class="wrap">
        <div class="guide-gate-fading">
          <div class="prose">
            <div class="callout">
              <p>클로드에 무료 스킬 팩을 붙이면 다섯 부서 몫을 대신 맡길 수 있습니다.</p>
            </div>
            <details class="toggle" open>
              <summary>⚡ 복사해서 바로 시작하는 프롬프트. 설치부터 검증까지</summary>
              <div class="codeblock">
                <pre><code class="language-text">입력: <span class="slot">&#x3C;운영체제와 셸, 예: macOS zsh></span>
/plugin marketplace add anthropics/knowledge-work-plugins</code></pre>
                <button type="button" class="copy">복사</button>
              </div>
            </details>
            <p>공식 GitHub: <a href="https://github.com/anthropics/knowledge-work-plugins?utm_source=share&amp;fbclid=IwAR123">knowledge-work-plugins</a></p>
          </div>
        </div>
        <section class="guide-gate">
          <p class="guide-gate-eyebrow">계속 읽기</p>
          <h3 class="guide-gate-title">이메일 하나면, 전부 무료입니다.</h3>
          <p><b>300만원</b> 상당의 문서와 프롬프트</p>
        </section>
        <div class="guide-gate-tail">
          <div class="prose">
            <h2>STEP 1. 준비물 확인</h2>
            <p>클로드 코드는 <a href="https://claude.com/claude-code">claude.com/claude-code</a>에서 설치합니다.</p>
            <p>플러그인 안내는 <a href="https://claude.com/plugins/">claude.com/plugins</a>입니다.</p>
            <p>마케팅은 <a href="https://github.com/coreyhaines31/marketingskills">marketingskills</a>입니다.</p>
            <p>SNS는 <a href="https://github.com/charlie947/social-media-skills">social-media-skills</a>입니다.</p>
            <p>디자인은 <a href="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill">ui-ux-pro-max-skill</a>과 <a href="https://github.com/Leonxlnx/taste-skill">taste-skill</a>입니다.</p>
            <p>Node.js는 <a href="https://nodejs.org/">nodejs.org</a>입니다.</p>
            <p>고칠 파일은 <code>SKILL.md</code>이고 voice-builder 다음 copywriting을 고칩니다.</p>
            <h2>STEP 7. 오늘 실행 순서</h2>
            <p><img src="/guides/84skills/g1-departments.webp" alt="다섯 부서 한눈에 보기"></p>
            <p><img src="/guides/84skills/g2-install.webp" alt="설치 3단계 공통 흐름"></p>
            <p><img src="/guides/84skills/g3-customize.webp" alt="원본 편집 금지, 복사본 편집"></p>
            <p><img src="/guides/84skills/g4-order.webp" alt="오늘 실행 순서 5단계"></p>
            <table><tr><th>스킬</th><th>하는 일</th></tr><tr><td>financial-statements</td><td>재무제표</td></tr></table>
            <table><tr><th>스킬</th><th>하는 일</th></tr><tr><td>ad-creative</td><td>광고</td></tr></table>
            <table><tr><th>위치</th><th>경로</th><th>적용 범위</th></tr><tr><td>계정</td><td>SKILL.md</td><td>전체</td></tr></table>
            <table><tr><th>부서</th><th>내용</th></tr><tr><td>마케팅</td><td>말투</td></tr></table>
            <table><tr><th>증상</th><th>원인</th><th>해결</th></tr><tr><td>목록에 없음</td><td>재시작 전</td><td>다시 켜기</td></tr></table>
            <p>인스타: <a href="https://www.instagram.com/lazy_owen/">게으른 빌더</a></p>
          </div>
        </div>
      </div>
    </article>
    <section class="section"><a href="/guides">가이드 전체 보기</a></section>
    <footer class="foot"><a href="https://www.youtube.com/@lazyowenAI">유튜브</a></footer>
    <div class="stickybar"><a href="https://www.youtube.com/@lazyowenAI">유튜브</a></div>
  </body>
</html>`;

function tableCount(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^\|(?:\s*---\s*\|)+$/.test(line.trim())).length;
}

function imageCount(markdown) {
  return [...markdown.matchAll(/!\[[^\]]*\]\([^)]+\)/g)].length;
}

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 게으른 빌더 다섯 부서 클로드 스킬 가이드를 Pages에만 저장한다"
  );
  assert.equal(source.includes('div.prose").first()'), false);
  assert.equal(source.includes('from("prompts")'), false);
});

test("stripTracking은 utm·fbclid·source=copy_link를 빼고 슬래시 없는 canonical을 유지한다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123&source=copy_link`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned, SOURCE_URL);
  assert.equal(SOURCE_URL.endsWith("/"), false);
});

test("parseLazyowenHtml은 두 prose를 합치고 게이트와 크롬을 뺀다", () => {
  const parsed = parseLazyowenHtml(FIXTURE, SOURCE_URL);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [게으른 빌더](${SOURCE_URL})`),
    true
  );
  const early = parsed.markdown.indexOf("다섯 부서 몫을 대신");
  const step = parsed.markdown.indexOf("STEP 1");
  assert.equal(early >= 0, true);
  assert.equal(step > early, true);
  assert.equal(parsed.markdown.includes("STEP 7"), true);
  assert.equal(
    parsed.markdown.includes("/plugin marketplace add anthropics/knowledge-work-plugins"),
    true
  );
  assert.equal(parsed.markdown.includes("voice-builder"), true);
  assert.equal(parsed.markdown.includes("copywriting"), true);
  assert.equal(parsed.markdown.includes("SKILL.md"), true);
  assert.equal(parsed.markdown.includes("<운영체제와 셸, 예: macOS zsh>"), true);
  assert.equal(imageCount(parsed.markdown), 4);
  assert.equal(tableCount(parsed.markdown), 5);
  for (const name of IMAGE_NAMES) {
    assert.equal(parsed.markdown.includes(name), true);
  }
  for (const alt of [
    "다섯 부서 한눈에 보기",
    "설치 3단계 공통 흐름",
    "원본 편집 금지, 복사본 편집",
    "오늘 실행 순서 5단계",
  ]) {
    assert.equal(parsed.markdown.includes(alt), true);
  }
  for (const href of [
    "https://claude.com/plugins/",
    "https://github.com/anthropics/knowledge-work-plugins",
    "https://github.com/coreyhaines31/marketingskills",
    "https://github.com/charlie947/social-media-skills",
    "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill",
    "https://github.com/Leonxlnx/taste-skill",
    "https://claude.com/claude-code",
    "https://nodejs.org/",
    "https://www.instagram.com/lazy_owen/",
  ]) {
    assert.equal(parsed.markdown.includes(href), true);
  }
  assert.equal(parsed.markdown.includes("30일 AI 챌린지"), false);
  assert.equal(parsed.markdown.includes("사전 등록 오픈"), false);
  assert.equal(parsed.markdown.includes("이메일 하나면"), false);
  assert.equal(parsed.markdown.includes("300만원"), false);
  assert.equal(parsed.markdown.includes("가이드 전체 보기"), false);
  assert.equal(parsed.markdown.includes("youtube.com/@lazyowenAI"), false);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(/^\s*복사(?:됨!)?\s*$/m.test(parsed.markdown), false);
});

test("만료 URL 문자열이 본문에 없으면 true다", () => {
  assert.equal(hasNoExpiredUrl("# 제목"), true);
  assert.equal(hasNoExpiredUrl("https://prod-files-secure.s3.amazonaws.com/x"), false);
  assert.equal(hasNoExpiredUrl("https://file.notion.so/f"), false);
  assert.equal(hasNoExpiredUrl("https://example.com/?X-Amz-Signature=1"), false);
  assert.equal(hasNoExpiredUrl("expirationTimestamp=1"), false);
  assert.equal(hasNoExpiredUrl("blob:https://example.com/1"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?fbclid=IwAR"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?utm_source=ig"), false);
});

test("다른 게으른 빌더 글과 제목·URL이 다르고 중복으로 보지 않는다", () => {
  assert.notEqual(PAGE_TITLE, YOUTUBE_TITLE);
  assert.notEqual(PAGE_TITLE, AGENCY_TITLE);
  assert.notEqual(SOURCE_URL, YOUTUBE_URL);
  assert.notEqual(SOURCE_URL, AGENCY_URL);
  assert.equal(PAGE_TITLE.includes("· 게으른 빌더"), false);
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
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, [SOURCE_URL]),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: YOUTUBE_TITLE, source_url: YOUTUBE_URL, content: YOUTUBE_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: AGENCY_TITLE, source_url: AGENCY_URL, content: AGENCY_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});
