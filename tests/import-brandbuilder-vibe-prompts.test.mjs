// BRANDBUILDER 바이브 코딩 프롬프트 7개 페이지 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PAGE_TITLE,
  SOURCE_URL,
  buildMarkdown,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-brandbuilder-vibe-prompts.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-brandbuilder-vibe-prompts.mjs"
);

const FIXTURE_PROMPTS = [
  {
    id: "prd",
    n: "01",
    title: "전체 PRD 작성하기",
    tag: "기획",
    hint: "앱 아이디어와 사용자·범위·제약 조건을 함께 전달하세요.",
    text: "너는 시니어 프로젝트 매니저야.",
  },
  {
    id: "skill",
    n: "08",
    title: "작업을 Skill로 만들기",
    tag: "자산화",
    hint: "작업이 완료된 대화에서 이어서 사용하세요.",
    text: "방금 이 작업을 너와 함께 했어.",
  },
];

const FIXTURE_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <title>바이브 코딩 프롬프트 | BRANDBUILDER</title>
    <meta property="og:title" content="BRANDBUILDER · 바이브 코딩 프롬프트">
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E">
  </head>
  <body>
    <header><button id="share">링크 공유 ↗</button></header>
    <p>기획부터 자산화까지, 바로 쓰는 7가지 실무 프롬프트.</p>
    <p class="source-note">첨부 카드뉴스의 프롬프트를 텍스트로 옮겼습니다. 원본 번호를 유지하여 07번은 없습니다.</p>
    <div class="credit">-by Brandbuilder-</div>
    <button id="copy-all">전체 프롬프트 복사</button>
    <dialog id="manual"><h2>텍스트 복사</h2></dialog>
    <div id="toast"></div>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// BRANDBUILDER 바이브 코딩 프롬프트 7개를 Pages에만 저장한다"
  );
});

test("stripTracking은 utm·fbclid·source=copy_link를 빼고 슬래시를 유지한다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123&source=copy_link`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned, SOURCE_URL);
  assert.equal(SOURCE_URL.endsWith("/"), true);
});

test("buildMarkdown은 개수가 달라도 제목·코드·해시링크·07번 문구를 넣는다", () => {
  const markdown = buildMarkdown(FIXTURE_PROMPTS, FIXTURE_HTML);
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    markdown.includes(`> 원문. [BRANDBUILDER](${SOURCE_URL})`),
    true
  );
  assert.equal(markdown.includes("07번은 없습니다"), true);
  for (const item of FIXTURE_PROMPTS) {
    assert.equal(markdown.includes(`## ${item.n} ${item.title}`), true);
    assert.equal(markdown.includes(item.text), true);
    assert.equal(markdown.includes(`${SOURCE_URL}#${item.id}`), true);
  }
  assert.equal((markdown.match(/```text/g) || []).length, 2);
  assert.equal(markdown.includes("링크 공유"), false);
  assert.equal(markdown.includes("전체 프롬프트 복사"), false);
  assert.equal(markdown.includes("<dialog"), false);
  assert.equal(markdown.includes("data:image/svg+xml"), false);
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
    isDuplicateRow({ title: "다른 글", content: SOURCE_URL }, PAGE_TITLE, [
      SOURCE_URL,
    ]),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, [SOURCE_URL]),
    false
  );
});
