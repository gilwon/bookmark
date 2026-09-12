// 게으른 빌더 유튜브 스킬 가이드 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  IMAGE_NAMES,
  PAGE_TITLE,
  SOURCE_URL,
  hasNoExpiredUrl,
  isDuplicateRow,
  parseLazyowenHtml,
  stripTracking,
} from "../scripts/import-lazyowen-claude-youtube-skill.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-lazyowen-claude-youtube-skill.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>유튜브 튜토리얼을 클로드가 실행하는 스킬로 바꾸는 세 가지 세팅 · 게으른 빌더</title>
  </head>
  <body>
    <nav class="nav"><a href="/challenge">30일 AI 챌린지</a></nav>
    <aside class="chband" aria-label="30일 AI 챌린지 사전 등록">
      <span class="kicker">사전 등록 오픈</span>
    </aside>
    <article class="article">
      <header class="article-head">
        <h1>유튜브 튜토리얼을 클로드가 실행하는 스킬로 바꾸는 세 가지 세팅</h1>
      </header>
      <div class="prose">
        <div class="callout">
          <p>클로드에게 유튜브 주소를 주면 제목만 보고 짐작합니다.</p>
        </div>
        <details class="toggle" open>
          <summary>⚡ 복사해서 바로 시작하는 프롬프트: 설치부터 검증까지 AI에게 맡기기</summary>
          <div class="codeblock">
            <pre><code class="language-text">입력: <span class="slot">&#x3C;운영체제와 셸, 예: macOS zsh></span>
/plugin marketplace add bradautomates/claude-video
/watch</code></pre>
            <button type="button" class="copy">복사</button>
          </div>
        </details>
        <p>공식 GitHub: <a href="https://github.com/bradautomates/claude-video?utm_source=share&amp;fbclid=IwAR123">bradautomates/claude-video</a></p>
        <p>인스타: <a href="https://www.instagram.com/lazy_owen/">게으른 빌더</a></p>
        <p><img src="/guides/claude-youtube-skill/g1-flow.webp" alt="세 가지 세팅과 영상 한 편이 스킬이 되기까지의 전체 흐름"></p>
        <div class="tablewrap">
          <table>
            <thead><tr><th>어디서 쓰나</th><th>설치 방법</th></tr></thead>
            <tbody><tr><td>클로드 코드</td><td>watch.skill</td></tr></tbody>
          </table>
        </div>
        <p>skill-creator와 ffmpeg, yt-dlp, Google AI Studio를 씁니다.</p>
      </div>
    </article>
    <section class="section"><a href="/guides">가이드 전체 보기</a></section>
    <footer class="foot"><a href="https://www.youtube.com/@lazyowenAI">유튜브</a></footer>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 게으른 빌더 유튜브 스킬 가이드를 Pages에만 저장한다"
  );
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

test("parseLazyowenHtml은 제목·원문 인용·본문만 남긴다", () => {
  const parsed = parseLazyowenHtml(FIXTURE, SOURCE_URL);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [게으른 빌더](${SOURCE_URL})`),
    true
  );
  assert.equal(
    parsed.markdown.includes("/plugin marketplace add bradautomates/claude-video"),
    true
  );
  assert.equal(parsed.markdown.includes("/watch"), true);
  assert.equal(parsed.markdown.includes("skill-creator"), true);
  assert.equal(parsed.markdown.includes("g1-flow.webp"), true);
  assert.equal(
    parsed.markdown.includes("https://github.com/bradautomates/claude-video"),
    true
  );
  assert.equal(
    parsed.markdown.includes("https://www.instagram.com/lazy_owen/"),
    true
  );
  assert.equal(
    parsed.markdown.includes("<운영체제와 셸, 예: macOS zsh>"),
    true
  );
  assert.equal(
    parsed.markdown.includes(
      "⚡ 복사해서 바로 시작하는 프롬프트: 설치부터 검증까지 AI에게 맡기기"
    ),
    true
  );
  assert.equal(parsed.markdown.includes("30일 AI 챌린지"), false);
  assert.equal(parsed.markdown.includes("사전 등록 오픈"), false);
  assert.equal(parsed.markdown.includes("가이드 전체 보기"), false);
  assert.equal(parsed.markdown.includes("youtube.com/@lazyowenAI"), false);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(/^\s*복사(?:됨!)?\s*$/m.test(parsed.markdown), false);
  assert.equal(IMAGE_NAMES.includes("g1-flow.webp"), true);
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
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, [SOURCE_URL]),
    false
  );
});
