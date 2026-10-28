// 낭만빌더 김스듴 MCP와 API 문서 가이드 이관 헬퍼를 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ANTHROPIC_URL,
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_LINKS,
  EXPECTED_TABLES,
  OG_IMAGE_BYTES,
  OG_IMAGE_SHA256,
  OG_IMAGE_URL,
  PAGE_TITLE,
  SOURCE_URL,
  isDuplicateRow,
  parseSdkKimHtml,
  stripTracking,
} from "../scripts/import-sdk-kim-mcp-vs-api-docs.mjs";

const OTHER_TITLE = "나를 위해 쉬지 않고 일하는 AI 직원: Munder Difflin으로 AI 사무실 차리는 법";
const OTHER_URL = "https://sdk-kim-builds.com/guides/munder-difflin-ai-employee-office";
const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-sdk-kim-mcp-vs-api-docs.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <body>
    <article class="guide-detail">
      <a class="guide-detail__back" href="/guides">목록</a>
      <header class="guide-detail__hero">
        <p class="guide-detail-category">개발</p>
        <h1>${PAGE_TITLE}</h1>
        <div class="guide-detail-meta"><time>2026. 10. 27.</time> Claude Code</div>
      </header>
      <details class="guide-mail">
        <summary>지금 다 못 읽겠다면</summary>
        <p>개인정보 수집·이용 동의</p>
        <p>발송 후 30일</p>
      </details>
      <details class="guide-toc"><summary>목차</summary><a href="#직접-재본-결과">직접 재본 결과</a></details>
      <div class="guide-detail-body">
        <h2>직접 재본 결과</h2>
        <p>2026-10-21 에 약 11.2만 토큰, 7.4배.</p>
        <table><tr><th>A</th></tr><tr><td>MCP</td></tr></table>
        <table><tr><th>상황</th></tr><tr><td>채팅앱</td></tr></table>
        <pre><code>claude mcp list</code></pre>
        <pre><code>scripts/notion.py</code></pre>
        <pre><code>SKILL.md</code></pre>
        <p><a href="${ANTHROPIC_URL}?utm_source=share&amp;fbclid=IwAR123">앤트로픽</a></p>
      </div>
      <aside class="guide-waitlist guide-card">
        <p>이 가이드, 내 업무에 30일 안에 적용해보고 싶다면</p>
        <p>이메일 알림 받기</p>
        <a href="/privacy">개인정보처리방침</a>
      </aside>
      <section class="guide-inquiry-block">
        <p>FOR TEAMS</p>
        <h2>이 가이드, 우리 팀에 적용하려면?</h2>
        <p>도입 상담 요청</p>
      </section>
      <nav class="guide-next">
        <a href="/guides/android-tv-ads-cleanup-claude/">안드로이드 TV</a>
      </nav>
      <nav class="guide-next guide-kakao">
        <a href="/kakao?utm_source=guide&amp;utm_medium=footer">오픈카톡</a>
      </nav>
    </article>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.split("\n")[0], "// 낭만빌더 김스듴 MCP와 API 문서 가이드를 Pages에만 저장한다.");
  assert.equal(source.includes(".guide-waitlist"), true);
  assert.equal(source.includes("details.guide-mail"), true);
  assert.equal(source.includes("nav.guide-next"), true);
  assert.equal(source.includes(OTHER_URL), false);
});

test("SOURCE_URL에 끝 슬래시와 추적 쿼리가 없다", () => {
  assert.equal(SOURCE_URL, "https://sdk-kim-builds.com/guides/mcp-vs-api-docs-claude-code");
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(PAGE_TITLE, "MCP는 이제 구닥다리: 코드 짜는 AI에는 API 문서를 주세요");
  assert.equal(OG_IMAGE_URL, "https://sdk-kim-builds.com/og/guides/mcp-vs-api-docs-claude-code.png");
  assert.equal(OG_IMAGE_BYTES, 30405);
  assert.equal(OG_IMAGE_SHA256, "d915e73269cf773c30983a4fab2bd5c5c814ef56a1763319b80acaee561fb0fa");
  assert.equal(EXPECTED_IMAGES, 1);
  assert.equal(EXPECTED_TABLES, 2);
  assert.equal(EXPECTED_CODES, 3);
  assert.equal(EXPECTED_LINKS, 2);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.notEqual(PAGE_TITLE, OTHER_TITLE);
  assert.notEqual(SOURCE_URL, OTHER_URL);
});

test("stripTracking은 utm과 fbclid를 빼고 localhost는 http로 남긴다", () => {
  assert.equal(stripTracking(`${SOURCE_URL}/?utm_source=share&fbclid=IwAR123`), `${SOURCE_URL}/`);
  assert.equal(stripTracking(`${ANTHROPIC_URL}?utm_medium=footer&fbclid=x`), ANTHROPIC_URL);
  assert.equal(stripTracking("http://localhost:3000/admin"), "http://localhost:3000/admin");
});

test("parseSdkKimHtml은 본문을 남기고 대기자 카드와 다음 글을 뺀다", () => {
  const parsed = parseSdkKimHtml(FIXTURE, `${SOURCE_URL}/?utm_source=share&fbclid=IwAR123`);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.includes(`> 원문. [낭만빌더 김스듴](${SOURCE_URL})`), true);
  assert.equal(parsed.markdown.includes("직접 재본 결과"), true);
  assert.equal(parsed.markdown.includes("개발"), true);
  assert.match(parsed.markdown, /\u200b2026\. 10\. 27\./);
  assert.equal(parsed.markdown.includes("2026-10-21"), true);
  assert.equal(parsed.markdown.includes(ANTHROPIC_URL), true);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_"), false);
  assert.equal(parsed.markdown.includes("30일"), false);
  assert.equal(parsed.markdown.includes("이메일 알림"), false);
  assert.equal(parsed.markdown.includes("개인정보"), false);
  assert.equal(parsed.markdown.includes("지금 다 못 읽겠다면"), false);
  assert.equal(parsed.markdown.includes("android-tv"), false);
  assert.equal(parsed.markdown.includes("오픈카톡"), false);
  assert.equal(parsed.markdown.includes("kakao"), false);
  assert.equal(parsed.markdown.includes("FOR TEAMS"), false);
  assert.equal(parsed.markdown.includes("도입 상담"), false);
  assert.equal(parsed.markdown.includes("우리 팀에 적용하려면"), false);
  assert.equal(parsed.markdown.includes("/privacy"), false);
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  tsx.register({ tsconfig: resolve(repo, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(repo, "src/lib/markdown-to-tiptap.ts"));
  const stored = JSON.stringify(markdownToTiptapDoc(parsed.markdown));
  assert.equal(stored.includes("2026. 10. 27."), true);
  assert.equal(stored.includes("\u200b2026. 10. 27."), true);
  assert.equal(stored.includes(ANTHROPIC_URL), true);
});

test("isDuplicateRow는 제목 또는 원문 주소만 본다", () => {
  assert.equal(isDuplicateRow({ title: PAGE_TITLE, source_url: "다른" }, PAGE_TITLE, [SOURCE_URL]), true);
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: `${SOURCE_URL}/?fbclid=IwAR123` }, PAGE_TITLE, [SOURCE_URL]),
    true
  );
  assert.equal(isDuplicateRow({ title: "다른 글", content: SOURCE_URL }, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(
    isDuplicateRow({ title: OTHER_TITLE, source_url: OTHER_URL }, PAGE_TITLE, [SOURCE_URL]),
    false
  );
  assert.equal(isDuplicateRow(null, PAGE_TITLE, [SOURCE_URL]), false);
});

test("스크립트는 Prompts 테이블과 행 갱신을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes(".update({"), false);
  assert.equal(source.includes(".upsert("), false);
  assert.equal(source.includes(".or("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("로컬과 운영 중 한쪽에만 글이 있습니다."), true);
});
