// 짐코딩 텐센트·클라우드플레어 오픈소스 AI 도구 가이드 이관 헬퍼를 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_FAQ,
  EXPECTED_IMAGES,
  EXPECTED_LINKS,
  EXPECTED_TABLES,
  LOCALHOST_HREF,
  PAGE_TITLE,
  REQUIRED_HREFS,
  SOURCE_URL,
  faqAnswerLengths,
  isDuplicateRow,
  isSkipImage,
  stripTracking,
} from "../scripts/import-gymcoding-tencent-cloudflare-ai-tools.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-gymcoding-tencent-cloudflare-ai-tools.mjs"
);

const OTHER_TITLE = "클로드 업무 활용법 5가지: 앤트로픽 엔지니어의 프롬프트·코드 실습";
const OTHER_URL =
  "https://www.gymcoding.co/articles/anthropic-engineer-claude-workflow-guide";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 짐코딩 텐센트·클라우드플레어 오픈소스 AI 도구 가이드를 Pages에만 저장한다."
  );
});

test("SOURCE_URL에 추적 쿼리가 없다", () => {
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(
    SOURCE_URL,
    "https://www.gymcoding.co/articles/tencent-cloudflare-open-source-ai-tools-guide"
  );
  assert.equal(
    PAGE_TITLE,
    "무료 AI 오픈소스 3종: security-audit-skill·BrowserSkill·WeKnora 설치·사용법"
  );
});

test("표지 1장, 표 6, 코드 19, 링크 72, 첨부 0, FAQ 6이다", () => {
  assert.equal(EXPECTED_IMAGES, 1);
  assert.equal(EXPECTED_TABLES, 6);
  assert.equal(EXPECTED_CODES, 19);
  assert.equal(EXPECTED_LINKS, 72);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_FAQ, 6);
  assert.equal(LOCALHOST_HREF, "http://localhost:8088/");
  assert.equal(REQUIRED_HREFS.includes(SOURCE_URL), true);
  assert.equal(REQUIRED_HREFS.includes(LOCALHOST_HREF), true);
  assert.equal(
    REQUIRED_HREFS.includes("https://github.com/cloudflare/security-audit-skill"),
    true
  );
  assert.equal(REQUIRED_HREFS.includes("https://github.com/Tencent/BrowserSkill"), true);
  assert.equal(REQUIRED_HREFS.includes("https://github.com/Tencent/WeKnora"), true);
});

test("isSkipImage는 logo.svg를 skip한다", () => {
  assert.equal(isSkipImage("/logo.svg"), true);
  assert.equal(isSkipImage("https://www.gymcoding.co/logo.svg"), true);
  assert.equal(
    isSkipImage("https://www.gymcoding.co/articles/tencent-cloudflare-open-source-ai-tools-guide/opengraph-image-1ya3q7"),
    false
  );
});

test("stripTracking은 fbclid만 빼고 localhost는 http로 남긴다", () => {
  assert.equal(stripTracking(`${SOURCE_URL}?fbclid=IwAR123&utm_source=share`), SOURCE_URL);
  assert.equal(stripTracking("http://localhost:8088"), LOCALHOST_HREF);
  assert.equal(stripTracking("http://localhost:3000/admin/courses"), "http://localhost:3000/admin/courses");
  assert.equal(
    stripTracking("http://host.docker.internal:11434"),
    "http://host.docker.internal:11434/"
  );
  assert.equal(
    stripTracking("http://gymcoding.co/articles/tencent-cloudflare-open-source-ai-tools-guide"),
    SOURCE_URL
  );
});

test("isDuplicateRow는 이 글만 true다", () => {
  assert.equal(isDuplicateRow({ title: PAGE_TITLE, source_url: "다른" }, PAGE_TITLE, SOURCE_URL), true);
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: `${SOURCE_URL}?fbclid=IwAR123` }, PAGE_TITLE, SOURCE_URL),
    true
  );
  assert.equal(isDuplicateRow({ title: OTHER_TITLE, source_url: OTHER_URL }, PAGE_TITLE, SOURCE_URL), false);
  assert.equal(isDuplicateRow(null, PAGE_TITLE, SOURCE_URL), false);
});

test("faqAnswerLengths는 답 글자 수를 센다", () => {
  const markdown = `# 제목

## 자주 묻는 질문

### 세 도구를 모두 설치해야 하나요?

세 도구는 묶음이 아닙니다. 필요한 하나만 설치하면 됩니다.

## 다음 절

다른 내용
`;
  assert.deepEqual(faqAnswerLengths(markdown), ["세 도구는 묶음이 아닙니다. 필요한 하나만 설치하면 됩니다.".length]);
});

test("스크립트는 Prompts 테이블과 행 갱신을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes(".update({"), false);
  assert.equal(source.includes(".upsert("), false);
  assert.equal(source.includes(".or("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("buildImportedPage"), true);
  assert.equal(source.includes("로컬과 운영 중 한쪽에만 글이 있습니다."), true);
  assert.equal(source.includes("LIST_URL"), false);
});
