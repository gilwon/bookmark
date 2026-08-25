// 워프센스 ChatGPT 이미지 프롬프트 20가지 글을 Pages에만 저장한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SOURCE_URL,
  cleanArticleMarkdown,
  isSkipImage,
} from "../scripts/import-worpsense-chatgpt-image-styles-page.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-worpsense-chatgpt-image-styles-page.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 워프센스 ChatGPT 이미지 프롬프트 20가지 글을 Pages에만 저장한다"
  );
});

test("SOURCE_URL에 fbclid가 없다", () => {
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("utm_"), false);
  assert.equal(
    SOURCE_URL,
    "https://worpsense.com/chatgpt-%EC%9D%B4%EB%AF%B8%EC%A7%80-%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-20%EA%B0%80%EC%A7%80-ai-%EC%9D%B4%EB%AF%B8%EC%A7%80-%EC%8A%A4%ED%83%80%EC%9D%BC-%ED%95%9C-%EB%B2%88%EC%97%90-%EB%B0%94/"
  );
});

test("광고·장식 이미지는 skip하고 본문 이미지는 남긴다", () => {
  assert.equal(isSkipImage("https://worpsense.com/logo.png"), true);
  assert.equal(
    isSkipImage(
      "https://secure.gravatar.com/avatar/2d4a3985bf915cb1af4d635a583d0b0abc30e219e51b1c4f49e4f3e8a2ece7fe?s=32"
    ),
    true
  );
  assert.equal(
    isSkipImage("https://worpsense.com/wp-content/uploads/2026/06/merlin_banner1-scaled.webp"),
    true
  );
  assert.equal(
    isSkipImage("https://worpsense.com/wp-content/themes/edubin/assets/images/shapes/HE001.png"),
    true
  );
  assert.equal(
    isSkipImage(
      "https://worpsense.com/wp-content/uploads/2026/08/클로드-AI로-자동화-하는-방법-300x158.webp"
    ),
    true
  );
  assert.equal(
    isSkipImage("https://worpsense.com/wp-content/uploads/2026/08/image-47-1024x768.webp"),
    false
  );
});

test("뉴스레터·요약하기·fbclid는 지우고 본문 프롬프트 문장은 남긴다", () => {
  const cleaned = cleanArticleMarkdown(`## 스타일 바꾸는 법

대상 + 표현 방식 + 구도

> 미러리스 카메라를 exploded view로 보여줘

> 빨간색 클래식 자동차를 blueprint 스타일로 그려줘

/exploded
/blueprint
/agingeffect

[원문](https://worpsense.com/chatgpt-image/?fbclid=IwAR123&utm_source=fb)

##### 워프센스 뉴스레터 구독하기

**1,690 +** 이상 구독중

구독하기

구독은 언제든지 해지할 수 있습니다.

## 다음 소제목

[ChatGPT로 요약하기](https://chat.openai.com/?q=x) [Google로 요약하기](https://www.google.com/search?q=x) [Grok로 요약하기](https://grok.com/?q=x)

❤️ 좋아요 12

### 댓글을 남겨주세요

댓글 본문

## 최신 글

다른 글
`);
  assert.equal(cleaned.includes("워프센스 뉴스레터 구독하기"), false);
  assert.equal(cleaned.includes("1,690"), false);
  assert.equal(cleaned.includes("구독은 언제든지 해지할 수 있습니다"), false);
  assert.equal(cleaned.includes("요약하기"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_"), false);
  assert.equal(cleaned.includes("좋아요"), false);
  assert.equal(cleaned.includes("댓글을 남겨주세요"), false);
  assert.equal(cleaned.includes("최신 글"), false);
  assert.equal(cleaned.includes("대상 + 표현 방식 + 구도"), true);
  assert.equal(cleaned.includes("미러리스 카메라를 exploded view"), true);
  assert.equal(cleaned.includes("빨간색 클래식 자동차를 blueprint"), true);
  assert.equal(cleaned.includes("/exploded"), true);
  assert.equal(cleaned.includes("/blueprint"), true);
  assert.equal(cleaned.includes("/agingeffect"), true);
});

test("CATEGORY/Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("INSERT INTO prompts"), false);
});
