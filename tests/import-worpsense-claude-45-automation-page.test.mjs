// 워프센스 45가지 자동화 글의 마크다운 정제와 이미지 skip을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanArticleMarkdown,
  isSkipImage,
} from "../scripts/import-worpsense-claude-45-automation-page.mjs";

test("광고·장식 이미지는 skip하고 본문 이미지는 남긴다", () => {
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
    isSkipImage("http://worpsense.com/wp-content/uploads/2026/02/뉴스레터-가입자이미지들2.webp"),
    true
  );
  assert.equal(
    isSkipImage(
      "http://worpsense.com/wp-content/uploads/2026/02/%EB%89%B4%EC%8A%A4%EB%A0%88%ED%84%B0-%EA%B0%80%EC%9E%85%EC%9E%90%EC%9D%B4%EB%AF%B8%EC%A7%80%EB%93%A42.webp"
    ),
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
    isSkipImage("https://worpsense.com/wp-content/uploads/2026/08/image-43-1024x768.webp"),
    false
  );
  assert.equal(
    isSkipImage(
      "https://worpsense.com/wp-content/uploads/2026/08/클로드-AI로-자동화-하는-방법.webp"
    ),
    false
  );
});

test("뉴스레터 삽입은 지우고 다음 소제목은 남긴다", () => {
  const cleaned = cleanArticleMarkdown(`## 21. 경쟁사 모니터링

경쟁사 뉴스를 조사합니다.

##### 워프센스 뉴스레터 구독하기

**1,690 +** 이상 구독중

구독하기

구독은 언제든지 해지할 수 있습니다.

## 22. 업계 뉴스 다이제스트

중요한 뉴스만 고릅니다.

# 파일 자동화 31~37
`);
  assert.equal(cleaned.includes("워프센스 뉴스레터 구독하기"), false);
  assert.equal(cleaned.includes("1,690"), false);
  assert.equal(cleaned.includes("구독은 언제든지 해지할 수 있습니다"), false);
  assert.equal(cleaned.includes("## 22. 업계 뉴스 다이제스트"), true);
  assert.equal(cleaned.includes("중요한 뉴스만 고릅니다."), true);
  assert.equal(cleaned.includes("# 파일 자동화 31~37"), true);
});

test("요약하기 링크와 링크에 감싼 이미지는 정리한다", () => {
  const cleaned = cleanArticleMarkdown(`[ChatGPT로 요약하기](https://chat.openai.com/?q=x) [Google로 요약하기](https://www.google.com/search?q=x) [Grok로 요약하기](https://grok.com/?q=x)

[![히어로](https://worpsense.com/hero.webp)](https://worpsense.com/merlin/)
`);
  assert.equal(cleaned.includes("요약하기"), false);
  assert.equal(cleaned.includes("chat.openai.com"), false);
  assert.equal(cleaned.includes("[![히어로]"), false);
  assert.equal(cleaned.includes("![히어로](https://worpsense.com/hero.webp)"), true);
});
