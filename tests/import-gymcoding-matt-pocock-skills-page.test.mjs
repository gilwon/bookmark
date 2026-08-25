// 짐코딩 Matt Pocock 스킬 설치 가이드 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SOURCE_URL,
  PAGE_TITLE,
  cleanArticleMarkdown,
  fillFaqAnswers,
  isSkipImage,
} from "../scripts/import-gymcoding-matt-pocock-skills-page.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-gymcoding-matt-pocock-skills-page.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 짐코딩 Matt Pocock 스킬 설치 가이드를 Pages에만 저장한다"
  );
});

test("SOURCE_URL에 fbclid가 없다", () => {
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(
    SOURCE_URL,
    "https://www.gymcoding.co/articles/matt-pocock-ai-skills-install-guide"
  );
  assert.equal(PAGE_TITLE.includes("Matt Pocock"), true);
});

test("isSkipImage는 logo.svg를 skip한다", () => {
  assert.equal(isSkipImage("/logo.svg"), true);
  assert.equal(isSkipImage("https://www.gymcoding.co/logo.svg"), true);
  assert.equal(
    isSkipImage("https://www.gymcoding.co/logo.svg?dpl=dpl_7PvbmTsQ9bEgaE3t6TgVR9c4s4nM"),
    true
  );
});

test("cleanArticleMarkdown은 뉴스레터·인프런·fbclid를 제거한다", () => {
  const cleaned = cleanArticleMarkdown(`본문입니다.

짐코딩 뉴스레터
동의하고 구독하기
[개인정보처리방침](/privacy#newsletter)

[추천 강의 인프런](https://inf.run/r4Wib?coupon_code=x)
클로드 코드 완벽 마스터
인프런에서 수강하기

[원문](https://www.gymcoding.co/articles/matt-pocock-ai-skills-install-guide?fbclid=IwAR123)
[깃허브](https://github.com/mattpocock/skills)
`);
  assert.equal(cleaned.includes("짐코딩 뉴스레터"), false);
  assert.equal(cleaned.includes("동의하고 구독"), false);
  assert.equal(cleaned.includes("인프런"), false);
  assert.equal(cleaned.includes("클로드 코드 완벽 마스터"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("/privacy#newsletter"), false);
  assert.equal(cleaned.includes("https://github.com/mattpocock/skills"), true);
  assert.equal(cleaned.includes("본문입니다."), true);
});

test("fillFaqAnswers는 빈 FAQ 제목 아래에 답을 넣는다", () => {
  const filled = fillFaqAnswers(`## 자주 묻는 질문

### 설치했는데 AI가 알아서 실행하지 않아요

### setup-matt-pocock-skills도 꼭 실행해야 하나요?

### 22개를 모두 설치해야 하나요?

### 스킬을 직접 수정하고 싶어요

### 웹 채팅에서도 사용할 수 있나요?

### 회사 코드나 내부 자료에도 써도 될까요?

### 업데이트는 어떻게 하나요?

### /handoff 파일을 찾을 수 없어요

### Claude Code와 Codex에서 호출 모양이 달라요
`);
  assert.equal(filled.includes("disable-model-invocation: true"), true);
  assert.equal(filled.includes("triage, to-spec, to-tickets"), true);
  assert.equal(filled.includes("skills.sh 방식에서는 필요한 스킬을 고를 수 있습니다"), true);
  assert.equal(filled.includes("두 방식을 함께 설치하지 마세요"), true);
  assert.equal(filled.includes("일반 웹 채팅에서는 스킬 내용을 직접 프롬프트로"), true);
  assert.equal(filled.includes("비밀번호, API 키, 고객 개인정보"), true);
  assert.equal(filled.includes("npx skills update"), true);
  assert.equal(filled.includes("운영체제의 임시 폴더에 저장되는 것이 정상"), true);
  assert.equal(filled.includes("$skill-name"), true);
});
