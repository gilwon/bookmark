// 스킬 정리와 매일 프롬프트 이관 스크립트의 주소와 중복 규칙을 확인한다.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TARGETS,
  isDuplicateRow,
  preprocessBlocks,
  stripTracking,
  unwrapCodeCallouts,
} from "../scripts/import-notion-skill-cleanup-daily-prompt.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-skill-cleanup-daily-prompt.mjs",
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const first = readFileSync(SCRIPT_PATH, "utf8").split("\n")[0];
  assert.equal(first.startsWith("// "), true);
  assert.equal(/[가-힣]/.test(first), true);
});

test("저장 주소에 추적 쿼리와 끝 슬래시가 없다", () => {
  assert.equal(TARGETS.length, 2);
  for (const spec of TARGETS) {
    assert.equal(spec.sourceUrl.includes("?"), false);
    assert.equal(spec.sourceUrl.endsWith("/"), false);
    assert.equal(spec.sourceUrl.includes(spec.hex), true);
  }
  assert.equal(
    stripTracking(
      "https://every-ai-guides.vercel.app/posts/insta-automation-free-prompts?from=dm&post=c25&fbclid=IwAR123",
    ),
    "https://every-ai-guides.vercel.app/posts/insta-automation-free-prompts?post=c25",
  );
  assert.equal(
    stripTracking("https://app.notion.com/p/4c8e43a1672082e1956f010642073465?pvs=39"),
    "https://app.notion.com/p/4c8e43a1672082e1956f010642073465",
  );
  assert.equal(stripTracking("http://localhost:3000/admin"), "http://localhost:3000/admin");
  assert.equal(
    stripTracking("https://instagram.com/beucheo.ai/"),
    "https://www.instagram.com/beucheo.ai",
  );
});

test("isDuplicateRow는 제목 또는 원문 주소만 본다", () => {
  const spec = TARGETS[0];
  assert.equal(isDuplicateRow({ title: spec.title, source_url: "다른" }, spec.title, [spec.sourceUrl]), true);
  assert.equal(
    isDuplicateRow({ title: "다른", source_url: `${spec.sourceUrl}?pvs=39` }, spec.title, [spec.sourceUrl]),
    true,
  );
  assert.equal(isDuplicateRow({ title: "다른", content: spec.sourceUrl }, spec.title, [spec.sourceUrl]), false);
  assert.equal(
    isDuplicateRow({ title: TARGETS[1].title, source_url: TARGETS[1].sourceUrl }, spec.title, [spec.sourceUrl]),
    false,
  );
  assert.equal(isDuplicateRow(null, spec.title, [spec.sourceUrl]), false);
});

test("북마크는 링크 문단으로 바뀐다", () => {
  const blocks = new Map([
    [
      "b1",
      {
        id: "b1",
        type: "bookmark",
        properties: { link: [["https://open.kakao.com/o/g8oGrusi?utm_source=share"]] },
      },
    ],
  ]);
  preprocessBlocks(blocks);
  const block = blocks.get("b1");
  assert.equal(block.type, "text");
  assert.equal(block.properties.title[0][1][0][1], "https://open.kakao.com/o/g8oGrusi");
});

test("콜아웃 안의 코드는 콜아웃 밖으로 나온다", () => {
  const blocks = new Map([
    ["page", { id: "page", type: "page", content: ["callout"] }],
    ["callout", { id: "callout", type: "callout", properties: { title: [] }, content: ["code"] }],
    ["code", { id: "code", type: "code", content: [] }],
  ]);
  unwrapCodeCallouts(blocks, "page");
  assert.deepEqual(blocks.get("page").content, ["code"]);
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
  assert.equal(source.includes(".guide-waitlist"), false);
});
