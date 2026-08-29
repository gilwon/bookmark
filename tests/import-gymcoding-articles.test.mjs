// 짐코딩 아티클 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SKIP_URLS,
  cleanGymMarkdown,
  extractGymAccordions,
  isSkipImage,
  listArticleUrlsFromHtml,
} from "../scripts/import-gymcoding-articles.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-gymcoding-articles.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 짐코딩 아티클 목록을 Pages에만 저장한다"
  );
});

test("listArticleUrlsFromHtml은 /articles 자신을 빼고 고유 경로만 남긴다", () => {
  const html = `
    <nav><a href="/articles">아티클</a></nav>
    <a href="/articles/foo-one">one</a>
    <a href="https://www.gymcoding.co/articles/foo-two">two</a>
    <a href="/articles/foo-one">dup</a>
  `;
  const urls = listArticleUrlsFromHtml(html);
  assert.deepEqual(urls, [
    "https://www.gymcoding.co/articles/foo-one",
    "https://www.gymcoding.co/articles/foo-two",
  ]);
  assert.equal(
    urls.some((url) => url === "https://www.gymcoding.co/articles"),
    false
  );
});

test("extractGymAccordions는 next_f의 이스케이프된 title/children을 푼다", () => {
  const snippet = String.raw`self.__next_f.push([1,"{\"title\":\"설치했는데 AI가 알아서 실행하지 않아요\",\"children\":\"disable-model-invocation: true 입니다\"}"])`;
  const faqs = extractGymAccordions(snippet);
  assert.equal(faqs.length, 1);
  assert.equal(faqs[0].title, "설치했는데 AI가 알아서 실행하지 않아요");
  assert.equal(faqs[0].children, "disable-model-invocation: true 입니다");
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

test("cleanGymMarkdown은 짐코딩 뉴스레터와 fbclid를 제거한다", () => {
  const cleaned = cleanGymMarkdown(`본문입니다.

짐코딩 뉴스레터
동의하고 구독하기
[개인정보처리방침](/privacy#newsletter)

[원문](https://www.gymcoding.co/articles/foo-one?fbclid=IwAR123)
`);
  assert.equal(cleaned.includes("짐코딩 뉴스레터"), false);
  assert.equal(cleaned.includes("동의하고 구독"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("/privacy#newsletter"), false);
  assert.equal(
    cleaned.includes("https://www.gymcoding.co/articles/foo-one"),
    true
  );
  assert.equal(cleaned.includes("본문입니다."), true);
});

test("SKIP_URLS에 기존 3건이 있다", () => {
  assert.equal(SKIP_URLS.length, 3);
  assert.equal(
    SKIP_URLS.includes(
      "https://www.gymcoding.co/articles/matt-pocock-ai-skills-install-guide"
    ),
    true
  );
  assert.equal(
    SKIP_URLS.includes(
      "https://www.gymcoding.co/articles/claude-code-eli5-guide"
    ),
    true
  );
  assert.equal(
    SKIP_URLS.includes(
      "https://www.gymcoding.co/articles/claude-code-skills-top-10-install-prompts"
    ),
    true
  );
});
