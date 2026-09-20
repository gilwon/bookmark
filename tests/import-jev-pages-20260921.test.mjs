// 티스토리 Jev 글과 Notion Jev 사례 15개 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_IMAGES,
  TARGETS,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-jev-pages-20260921.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-jev-pages-20260921.mjs"
);
const GYMCODING_URL =
  "https://www.gymcoding.co/articles/anthropic-engineer-claude-workflow-guide";
const GYMCODING_TITLE =
  "클로드 업무 활용법 5가지: 앤트로픽 엔지니어의 프롬프트·코드 실습";
const GYMCODING_ID = "caea2c69-9dd7-4e8a-90dd-0649f25dd91c";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 티스토리 Jev 글과 Notion Jev 사례 15개를 Pages에만 저장한다"
  );
});

test("대상 2건의 키·이미지·첨부 수가 맞다", () => {
  assert.equal(TARGETS.length, 2);
  const tistory = TARGETS.find((item) => item.key === "tistory");
  const notion = TARGETS.find((item) => item.key === "notion");
  assert.equal(Boolean(tistory), true);
  assert.equal(Boolean(notion), true);
  assert.equal(
    tistory.title,
    "글도 못 쓰는 AI가 왜 난리? Jev로 논문 1,018편 분류하고, 게임까지 돌린 사람들"
  );
  assert.equal(tistory.sourceUrl, "https://seo2-heimish.tistory.com/20");
  assert.equal(tistory.images, 5);
  assert.equal(tistory.attachments, 0);
  assert.equal(notion.title, "Jev 활용 사례 15개 정리본");
  assert.equal(notion.hex, "3e1fd99f0e5f81df86b7feae226dca6e");
  assert.equal(notion.pageId, "3e1fd99f-0e5f-81df-86b7-feae226dca6e");
  assert.equal(
    notion.sourceUrl,
    "https://app.notion.com/p/Jev-15-3e1fd99f0e5f81df86b7feae226dca6e"
  );
  assert.equal(notion.images, 3);
  assert.equal(notion.attachments, 7);
  assert.deepEqual(EXPECTED_IMAGES, { tistory: 5, notion: 3 });
  assert.equal(notion.sourceUrl.includes(notion.hex), true);
});

test("짐코딩 URL은 이 스크립트가 다시 넣지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes(GYMCODING_URL), false);
  assert.equal(source.includes("SOURCE_URL"), false);
  for (const item of TARGETS) {
    assert.equal(String(item.sourceUrl ?? "").includes("gymcoding"), false);
    assert.equal(item.title === GYMCODING_TITLE, false);
  }
});

test("stripTracking은 fbclid·source=copy_link를 빼고 /m/은 데스크톱 경로다", () => {
  const tistory = TARGETS.find((item) => item.key === "tistory");
  const notion = TARGETS.find((item) => item.key === "notion");
  assert.equal(
    stripTracking(`${tistory.sourceUrl}?fbclid=IwAR123&utm_source=share`),
    tistory.sourceUrl
  );
  assert.equal(
    stripTracking("https://seo2-heimish.tistory.com/m/20?fbclid=IwAR123"),
    tistory.sourceUrl
  );
  const dirty = `${notion.sourceUrl}?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("pvs"), false);
  assert.equal(cleaned, notion.sourceUrl);
  assert.equal(stripTracking("http://typesafe.ai"), "https://typesafe.ai");
});

test("만료 URL 문자열이 본문에 없으면 true다", () => {
  assert.equal(hasNoExpiredUrl("# 제목\n\n본문입니다."), true);
  assert.equal(
    hasNoExpiredUrl("https://prod-files-secure.s3.us-west-2.amazonaws.com/x"),
    false
  );
  assert.equal(hasNoExpiredUrl("https://file.notion.so/f"), false);
  assert.equal(hasNoExpiredUrl("https://example.com/?X-Amz-Signature=1"), false);
  assert.equal(hasNoExpiredUrl("expirationTimestamp=1"), false);
  assert.equal(hasNoExpiredUrl("blob:https://example.com/1"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?fbclid=IwAR"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?utm_source=ig"), false);
  assert.equal(
    hasNoExpiredUrl("https://blog.kakaocdn.net/dna/x/img.png?credential=abc"),
    false
  );
  assert.equal(
    hasNoExpiredUrl("https://blog.kakaocdn.net/dna/x/img.png?expires=1"),
    false
  );
  assert.equal(
    hasNoExpiredUrl("https://blog.kakaocdn.net/dna/x/img.png?signature=abc"),
    false
  );
});

test("isDuplicateRow는 짐코딩 기존 행에 대해 false다", () => {
  const tistory = TARGETS.find((item) => item.key === "tistory");
  const notion = TARGETS.find((item) => item.key === "notion");
  const gymRow = {
    id: GYMCODING_ID,
    title: GYMCODING_TITLE,
    source_url: GYMCODING_URL,
    content: `${tistory.title}\n${notion.title}\n${notion.hex}`,
  };
  assert.equal(
    isDuplicateRow(gymRow, tistory.title, [tistory.sourceUrl]),
    false
  );
  assert.equal(
    isDuplicateRow(gymRow, notion.title, [
      notion.sourceUrl,
      notion.pageId,
      notion.hex,
    ]),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: tistory.title, source_url: tistory.sourceUrl, content: "x" },
      tistory.title,
      [tistory.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: notion.sourceUrl, content: "없음" },
      notion.title,
      [notion.sourceUrl, notion.pageId, notion.hex]
    ),
    true
  );
});

test("스크립트는 Prompts 테이블을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
});
