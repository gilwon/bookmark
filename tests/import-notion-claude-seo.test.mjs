// Claude SEO 이관 스크립트의 주소와 중복 규칙을 확인한다.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_TITLE,
  SOURCE_URL,
  autolinkBareUrls,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-notion-claude-seo.mjs";

const SCRIPT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/import-notion-claude-seo.mjs");

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const first = readFileSync(SCRIPT_PATH, "utf8").split("\n")[0];
  assert.equal(first.startsWith("// "), true);
  assert.equal(/[가-힣]/.test(first), true);
});

test("추적 쿼리를 빼고 유튜브 영상 번호는 남긴다", () => {
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(
    stripTracking("https://www.youtube.com/watch?v=COMnNlUakQk&fbclid=IwAR"),
    "https://www.youtube.com/watch?v=COMnNlUakQk",
  );
  assert.equal(stripTracking("http://localhost:11235/mcp/sse"), "http://localhost:11235/mcp/sse");
  assert.equal(PAGE_TITLE.includes("SEO"), true);
});

test("공식 주소만 링크로 만들고 예시 주소는 그대로 둔다", () => {
  const markdown = [
    "저장소: https://github.com/AgriciDaniel/claude-seo",
    "페이지 하나만 깊게 보려면 `/seo page https://내사이트주소/페이지`",
    "```",
    "/seo audit https://내사이트주소",
    "```",
  ].join("\n");
  const linked = autolinkBareUrls(markdown);
  assert.equal(linked.includes("[https://github.com/AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo)"), true);
  assert.equal(linked.includes("`/seo page https://내사이트주소/페이지`"), true);
  assert.equal(linked.includes("/seo audit https://내사이트주소"), true);
  assert.equal(linked.includes("[https://내사이트주소]"), false);
});

test("isDuplicateRow는 제목 또는 원문 주소만 본다", () => {
  assert.equal(isDuplicateRow({ title: PAGE_TITLE, source_url: "다른" }, PAGE_TITLE, [SOURCE_URL]), true);
  assert.equal(isDuplicateRow({ title: "다른", source_url: `${SOURCE_URL}?pvs=39` }, PAGE_TITLE, [SOURCE_URL]), true);
  assert.equal(isDuplicateRow({ title: "다른", content: SOURCE_URL }, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(isDuplicateRow({ title: "다른", source_url: "" }, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(isDuplicateRow(null, PAGE_TITLE, [SOURCE_URL]), false);
});

test("스크립트는 Prompts 테이블과 행 갱신을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes(".update({"), false);
  assert.equal(source.includes(".upsert("), false);
  assert.equal(source.includes(".or("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("content LIKE"), false);
  assert.equal(source.includes("로컬과 운영 중 한쪽에만 글이 있습니다."), true);
});
