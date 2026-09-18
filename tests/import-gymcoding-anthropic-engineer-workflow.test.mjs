// 짐코딩 앤트로픽 엔지니어 클로드 업무 활용법 가이드 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_IMAGES,
  PAGE_TITLE,
  SOURCE_URL,
  YOUTUBE_URL,
  cleanGymMarkdown,
  isDuplicateRow,
  isSkipImage,
  stripTracking,
} from "../scripts/import-gymcoding-anthropic-engineer-workflow.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-gymcoding-anthropic-engineer-workflow.mjs"
);

const OTHER_TITLE = "앤트로픽 엔지니어가 알려준 진짜 되는 AI 에이전트 설계법";
const OTHER_URL =
  "https://www.gymcoding.co/articles/real-effective-ai-agents-anthropic-claude-code";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 짐코딩 앤트로픽 엔지니어 클로드 업무 활용법 가이드를 Pages에만 저장한다"
  );
});

test("SOURCE_URL에 fbclid가 없다", () => {
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(
    SOURCE_URL,
    "https://www.gymcoding.co/articles/anthropic-engineer-claude-workflow-guide"
  );
  assert.equal(
    PAGE_TITLE,
    "클로드 업무 활용법 5가지: 앤트로픽 엔지니어의 프롬프트·코드 실습"
  );
});

test("이미지 2장·첨부 0개다", () => {
  assert.equal(EXPECTED_IMAGES, 2);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
});

test("YouTube URL 상수가 있다", () => {
  assert.equal(YOUTUBE_URL, "https://www.youtube.com/watch?v=qqrk7CtkuIw");
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes(YOUTUBE_URL), true);
});

test("isSkipImage는 logo.svg를 skip한다", () => {
  assert.equal(isSkipImage("/logo.svg"), true);
  assert.equal(isSkipImage("https://www.gymcoding.co/logo.svg"), true);
  assert.equal(
    isSkipImage(
      "https://www.gymcoding.co/logo.svg?dpl=dpl_7PvbmTsQ9bEgaE3t6TgVR9c4s4nM"
    ),
    true
  );
});

test("stripTracking과 cleanGymMarkdown은 fbclid·inf.run·뉴스레터를 제거한다", () => {
  const dirty = `${SOURCE_URL}?fbclid=IwAR123`;
  assert.equal(stripTracking(dirty), SOURCE_URL);
  assert.equal(stripTracking(dirty).includes("fbclid"), false);

  const cleaned = cleanGymMarkdown(`본문입니다.

짐코딩 뉴스레터
동의하고 구독하기
[개인정보처리방침](/privacy#newsletter)

[추천 강의 인프런](https://inf.run/r4Wib?coupon_code=x)
클로드 코드 완벽 마스터
인프런에서 수강하기

[원문](${SOURCE_URL}?fbclid=IwAR123)
`);
  assert.equal(cleaned.includes("짐코딩 뉴스레터"), false);
  assert.equal(cleaned.includes("동의하고 구독"), false);
  assert.equal(cleaned.includes("inf.run"), false);
  assert.equal(cleaned.includes("인프런에서 수강하기"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("/privacy#newsletter"), false);
  assert.equal(cleaned.includes(SOURCE_URL), true);
  assert.equal(cleaned.includes("본문입니다."), true);
});

test("isDuplicateRow는 이 글 제목만 true다", () => {
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
      {
        title: OTHER_TITLE,
        source_url: OTHER_URL,
        content: "다른 글",
      },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});

test("스크립트는 Prompts 테이블을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
});
