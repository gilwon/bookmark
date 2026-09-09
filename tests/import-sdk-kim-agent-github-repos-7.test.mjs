// 낭만빌더 김스듴 에이전트 GitHub 레포 7개 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_IMAGES,
  OG_IMAGE_BYTES,
  PAGE_TITLE,
  SOURCE_URL,
  isDuplicateRow,
  parseSdkKimHtml,
  stripTracking,
} from "../scripts/import-sdk-kim-agent-github-repos-7.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-sdk-kim-agent-github-repos-7.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>AI 에이전트 역량을 늘려주는 GitHub 레포 7개 (별점·라이선스 실측) | 낭만빌더 김스듴</title>
    <link rel="icon" href="/favicon.ico">
    <meta property="og:image" content="https://sdk-kim-builds.com/og/default.png">
  </head>
  <body>
    <header class="home-header">
      <a href="https://instagram.com/sdk.kim.builds">인스타</a>
      <span>30일 챌린지</span>
    </header>
    <article class="guide-detail">
      <a class="guide-detail__back" href="/guides">목록</a>
      <p>생산성 · 2026-09-01</p>
      <h1>AI 에이전트 역량을 늘려주는 GitHub 레포 7개 (별점·라이선스 실측)</h1>
      <div class="guide-detail-body">
        <p>에이전트 역량을 늘려주는 GitHub 레포를 별점·라이선스 기준으로 골랐습니다.</p>
        <blockquote>No shadows. No Mermaid slop.</blockquote>
        <p><a href="https://github.com/browser-use/browser-use?fbclid=IwAR123">browser-use</a></p>
        <p><a href="https://github.com/anthropics/skills">anthropics/skills</a></p>
        <table>
          <tr><th>레포</th><th>라이선스</th></tr>
          <tr><td>Diagram Design</td><td>AGPL</td></tr>
        </table>
      </div>
      <aside class="guide-detail__cta">
        <a href="https://ax.sdk-kim-builds.com">FOR TEAMS</a>
      </aside>
    </article>
    <footer class="home-footer">푸터</footer>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 낭만빌더 김스듴 에이전트 GitHub 레포 7개를 Pages에만 저장한다"
  );
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://sdk-kim-builds.com/guides/agent-github-repos-7"
  );
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(
    PAGE_TITLE,
    "AI 에이전트 역량을 늘려주는 GitHub 레포 7개 (별점·라이선스 실측)"
  );
  assert.equal(OG_IMAGE_BYTES, 3992);
  assert.equal(EXPECTED_IMAGES, 1);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
});

test("stripTracking은 utm·fbclid를 뺀다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("parseSdkKimHtml은 제목과 본문을 남긴다", () => {
  const parsed = parseSdkKimHtml(FIXTURE, SOURCE_URL);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [낭만빌더 김스듴](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("별점·라이선스"), true);
  assert.equal(parsed.markdown.includes("생산성"), true);
  assert.equal(parsed.markdown.includes("No shadows. No Mermaid slop."), true);
  assert.equal(
    parsed.markdown.includes("https://github.com/browser-use/browser-use"),
    true
  );
  assert.equal(
    parsed.markdown.includes("https://github.com/anthropics/skills"),
    true
  );
  assert.equal(parsed.markdown.includes("| 레포 |"), true);
  assert.equal(parsed.markdown.includes("Diagram Design"), true);
  assert.equal(parsed.markdown.includes("![표지]"), false);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("ax.sdk-kim-builds.com"), false);
  assert.equal(parsed.markdown.includes("FOR TEAMS"), false);
  assert.equal(parsed.markdown.includes("30일 챌린지"), false);
  assert.equal(parsed.markdown.includes("instagram.com/sdk.kim.builds"), false);
  assert.equal(parsed.markdown.includes("favicon"), false);
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

test("CATEGORY/Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
});
