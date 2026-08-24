// REBORN 프롬프트 정리기 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SOURCE_URL,
  PAGE_TITLE,
  REQUIRED_PHRASES,
  cleanArticleMarkdown,
  stripTrackingUrl,
} from "../scripts/import-reborn-prompt-page.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-reborn-prompt-page.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// REBORN 프롬프트 정리기 랜딩을 Pages에만 저장한다"
  );
});

test("SOURCE_URL에 utm이 없다", () => {
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(SOURCE_URL.includes("utm_medium"), false);
  assert.equal(SOURCE_URL.includes("utm_campaign"), false);
  assert.equal(SOURCE_URL.includes("funnel-utm"), false);
  assert.equal(SOURCE_URL, "https://rebornlabs.kr/prompt");
});

test("REQUIRED_PHRASES는 스크립트 상수다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes("export const REQUIRED_PHRASES"), true);
  assert.equal(Array.isArray(REQUIRED_PHRASES), true);
  for (const phrase of [
    "네 칸을 대신 채웁니다",
    "CheckoutForm.tsx",
    ".claude/decisions.md",
    "npx reborn-prompt",
    "reborn-prompt 설치해줘",
    "https://rebornlabs.kr/reborn-prompt.zip",
    "https://rebornlabs.kr/claudekit",
  ]) {
    assert.equal(REQUIRED_PHRASES.includes(phrase), true, phrase);
  }
  assert.equal(PAGE_TITLE.includes("프롬프트 정리기"), true);
});

test("stripTrackingUrl은 utm을 빼고 zip을 절대 경로로 바꾼다", () => {
  assert.equal(
    stripTrackingUrl(
      "https://rebornlabs.kr/claudekit?utm_source=prompt&utm_medium=landing&utm_campaign=prompt"
    ),
    "https://rebornlabs.kr/claudekit"
  );
  assert.equal(
    stripTrackingUrl("/reborn-prompt.zip"),
    "https://rebornlabs.kr/reborn-prompt.zip"
  );
});

test("cleanArticleMarkdown은 utm을 제거하고 zip을 절대 경로로 바꾼다", () => {
  const cleaned = cleanArticleMarkdown(`# 제목

[클로드킷](https://rebornlabs.kr/claudekit?utm_source=prompt&utm_medium=landing&utm_campaign=prompt)
[zip 으로 받으셔도](/reborn-prompt.zip)
\\[할 일\\]
결제 폼 제출이 되게 고친다
`);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("utm_medium"), false);
  assert.equal(cleaned.includes("utm_campaign"), false);
  assert.equal(cleaned.includes("funnel-utm"), false);
  assert.equal(cleaned.includes("https://rebornlabs.kr/claudekit"), true);
  assert.equal(cleaned.includes("https://rebornlabs.kr/reborn-prompt.zip"), true);
  assert.equal(cleaned.includes("](/reborn-prompt.zip)"), false);
  assert.equal(cleaned.includes("[할 일]"), true);
  assert.equal(cleaned.includes("\\[할 일\\]"), false);
});
