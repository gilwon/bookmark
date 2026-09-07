// 영선 TOP 3와 짐코딩 스킬 실전 가이드 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  GITHUB_URLS,
  GOOGLE_DOCS_URL,
  GYMCODING_URL,
  YEONGSEON_TITLE,
  YEONGSEON_URL,
  isDuplicateRow,
  parseYeongseonHtml,
  stripTracking,
} from "../scripts/import-pages-20260907.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-pages-20260907.mjs"
);

const DATA_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>직장인들을 위한 무료 오픈소스 TOP 3 · 신영선 자료</title>
  </head>
  <body>
    <header class="nav"><a class="brand" href="../index.html">신영선</a></header>
    <article class="wrap">
      <ul class="chips"><li class="src">에이나우</li><li class="lv">기본 과정</li></ul>
      <h1>직장인들을 위한 무료 오픈소스 TOP 3</h1>
      <p class="sum">하루를 잡아먹는 건 회의가 아닙니다</p>
      <p class="meta">2026-08-03</p>
      <aside class="note">10배 더 빠르게 흡수하는 방법</aside>
      <ol class="steps">
        <li>릴스 영상을 저장 또는 공유하기로 기록 해놓습니다.</li>
        <li>바로 사용을 해봅니다. 절대 미루지 마세요.</li>
      </ol>
      <h3>1. 오픈소스 활용 가이드북</h3>
      <figure class="doc">
        <a href="${GOOGLE_DOCS_URL}&amp;fbclid=IwAR123">
          <img src="${DATA_PNG}" alt="직장인 문서 자동화 오픈소스 3종 첫 장">
        </a>
      </figure>
      <p class="dl">
        <a href="${GOOGLE_DOCS_URL}&amp;utm_source=share">🔗 직장인 문서 자동화 오픈소스 3종 열기 (Google Docs)</a>
      </p>
      <h3>2. 깃허브 오픈 소스</h3>
      <ul><li>Office CLI</li></ul>
      <a class="bm" href="https://github.com/iOfficeAI/OfficeCLI">
        <span class="bm-txt"><span class="bm-t">iOfficeAI/OfficeCLI — github.com</span></span>
      </a>
      <ul><li>Pandoc</li></ul>
      <a class="bm" href="https://github.com/jgm/pandoc">
        <span class="bm-txt"><span class="bm-t">jgm/pandoc — github.com</span></span>
      </a>
      <ul>
        <li>markitdown</li>
        <aside class="promo"></aside>
      </ul>
      <a class="bm" href="https://github.com/microsoft/markitdown">
        <span class="bm-txt"><span class="bm-t">microsoft/markitdown — github.com</span></span>
      </a>
      <aside class="note">[D-DAY 7일]</aside>
      <p>유일한 클로드코드 무료 강의가 일주일 뒤 시작됩니다.</p>
      <p>[단톡방 입장] <a href="https://open.kakao.com/o/g5J6qjFi">https://open.kakao.com/o/g5J6qjFi</a></p>
      <nav class="rel" aria-label="관련 자료">
        <h2>이어서 볼 것</h2>
        <ul>
          <li><a href="390d86104de280958a15e5964e5100ad.html">지금이 역사상 가장 좋은 때입니다</a></li>
        </ul>
      </nav>
      <div class="cta">
        <p>이런 자료를 이메일로 받아보시겠습니까? 무료 강의 안내도 같이 갑니다.</p>
        <a class="btn" href="../index.html#apply">무료로 신청하기</a>
      </div>
    </article>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 영선 오픈소스 TOP 3와 짐코딩 스킬 실전 가이드를 Pages에만 저장한다"
  );
});

test("stripTracking은 fbclid·utm을 빼고 usp=sharing은 남긴다", () => {
  assert.equal(
    stripTracking(`${YEONGSEON_URL}?fbclid=IwAR123&utm_source=share`),
    YEONGSEON_URL
  );
  assert.equal(stripTracking(GOOGLE_DOCS_URL), GOOGLE_DOCS_URL);
  assert.equal(
    stripTracking(`${GOOGLE_DOCS_URL}&fbclid=IwAR123&utm_medium=social`),
    GOOGLE_DOCS_URL
  );
  assert.equal(stripTracking(GOOGLE_DOCS_URL).includes("usp=sharing"), true);
  assert.equal(stripTracking(`${GYMCODING_URL}?fbclid=IwAR`).includes("fbclid"), false);
});

test("parseYeongseonHtml은 본문·문서·GitHub를 남기고 홍보를 뺀다", () => {
  const parsed = parseYeongseonHtml(FIXTURE);
  assert.equal(parsed.title, YEONGSEON_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${YEONGSEON_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [신영선 자료](${YEONGSEON_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("하루를 잡아먹는 건 회의가 아닙니다"), true);
  assert.equal(parsed.markdown.includes("10배 더 빠르게 흡수하는 방법"), true);
  assert.equal(parsed.markdown.includes("절대 미루지 마세요"), true);
  for (const url of GITHUB_URLS) {
    assert.equal(parsed.markdown.includes(url), true, url);
  }
  assert.equal(parsed.markdown.includes(GOOGLE_DOCS_URL), true);
  assert.equal(parsed.markdown.includes("usp=sharing"), true);
  assert.equal(
    parsed.markdown.includes("![직장인 문서 자동화 오픈소스 3종 첫 장](data:image/png;base64,"),
    true
  );
  assert.equal(parsed.markdown.includes("D-DAY"), false);
  assert.equal(parsed.markdown.includes("open.kakao.com"), false);
  assert.equal(parsed.markdown.includes("이어서 볼 것"), false);
  assert.equal(parsed.markdown.includes("이메일로 받아"), false);
  assert.equal(parsed.markdown.includes("에이나우"), false);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes("390d86104de280958a15e5964e5100ad.html"), false);
});

test("isDuplicateRow는 같은 source_url만 true다", () => {
  assert.equal(
    isDuplicateRow(
      { title: YEONGSEON_TITLE, source_url: YEONGSEON_URL, content: "x" },
      YEONGSEON_TITLE,
      [YEONGSEON_URL]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      {
        title: YEONGSEON_TITLE,
        source_url: "https://app.notion.com/p/1b3b256827ac8236a95101d21398974d",
        content: "노션 복사본",
      },
      YEONGSEON_TITLE,
      [YEONGSEON_URL]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "클로드 코드 스킬 추천 5개: 설치·검증·실전 프롬프트",
        source_url:
          "https://www.gymcoding.co/articles/claude-code-must-have-skills-5",
        content: "다른 글",
      },
      "클로드 코드 스킬 추천 5개: 설치 방법·실전 프롬프트·코드 예시",
      [GYMCODING_URL]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${YEONGSEON_URL}` },
      YEONGSEON_TITLE,
      [YEONGSEON_URL]
    ),
    true
  );
});

test("스크립트는 Prompts 테이블을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
});
