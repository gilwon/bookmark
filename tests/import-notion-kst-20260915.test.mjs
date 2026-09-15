// 한국 시간 이번 주 Notion 신규 3건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  TARGETS,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-notion-kst-20260915.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = resolve(root, "scripts/import-notion-kst-20260915.mjs");
const EMOJI_RE = /\p{Extended_Pictographic}/u;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 이번 주 Notion 신규 3건을 Pages에만 저장한다"
  );
});

test("stripTracking은 pvs·utm·fbclid·igsh·mcp_token·copy_link를 뺀다", () => {
  const skill = TARGETS.find((item) => item.key === "skill");
  const cases = [
    [`${skill.sourceUrl}?pvs=204`, skill.sourceUrl],
    [
      "https://www.instagram.com/nookitokki?utm_source=ig&utm_medium=social&fbclid=IwAR123&igsh=abc",
      "https://www.instagram.com/nookitokki",
    ],
    [
      `${skill.sourceUrl}?source=copy_link&mcp_token=abc&utm_campaign=share`,
      skill.sourceUrl,
    ],
  ];
  for (const [dirty, clean] of cases) {
    const cleaned = stripTracking(dirty);
    assert.equal(cleaned.includes("pvs="), false, dirty);
    assert.equal(cleaned.includes("utm_source"), false, dirty);
    assert.equal(cleaned.includes("utm_medium"), false, dirty);
    assert.equal(cleaned.includes("utm_campaign"), false, dirty);
    assert.equal(cleaned.includes("fbclid"), false, dirty);
    assert.equal(cleaned.includes("igsh"), false, dirty);
    assert.equal(cleaned.includes("mcp_token"), false, dirty);
    assert.equal(cleaned.includes("source=copy_link"), false, dirty);
    assert.equal(cleaned, clean);
  }
});

test("대상 3건의 제목·hex가 서로 다르고 이모지가 없다", () => {
  assert.equal(TARGETS.length, 3);
  assert.deepEqual(
    TARGETS.map((item) => item.key),
    ["skill", "team", "oss"]
  );
  const titles = TARGETS.map((item) => item.title);
  const hexes = TARGETS.map((item) => item.hex);
  const pageIds = TARGETS.map((item) => item.pageId);
  assert.equal(new Set(titles).size, 3);
  assert.equal(new Set(hexes).size, 3);
  assert.equal(new Set(pageIds).size, 3);
  for (const item of TARGETS) {
    assert.equal(item.images, 0, item.key);
    assert.equal(item.attachments, 0, item.key);
    assert.equal(item.title.includes("🚀"), false, item.title);
    assert.equal(EMOJI_RE.test(item.title), false, item.title);
    assert.equal(Boolean(item.hex), true, item.key);
    assert.notEqual(item.title, item.hex);
  }
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
});

test("isDuplicateRow는 제목 또는 hex로 true다", () => {
  const skill = TARGETS.find((item) => item.key === "skill");
  const team = TARGETS.find((item) => item.key === "team");
  const oss = TARGETS.find((item) => item.key === "oss");
  assert.equal(Boolean(skill?.hex), true);
  assert.equal(Boolean(team?.hex), true);
  assert.equal(Boolean(oss?.hex), true);
  assert.equal(
    isDuplicateRow(
      { title: skill.title, content: "x" },
      skill.title,
      [skill.hex]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${skill.hex}` },
      skill.title,
      [skill.hex]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: "없음" },
      skill.title,
      [skill.hex]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${team.hex}` },
      team.title,
      [team.hex]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: oss.sourceUrl, content: "없음" },
      oss.title,
      [oss.hex, oss.sourceUrl]
    ),
    true
  );
});

test("스크립트는 Prompts 테이블을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
});

test("덤프가 있으면 본문 문구가 있고 만료 URL이 없다", () => {
  for (const item of TARGETS) {
    const bodyPath = resolve(root, item.body);
    if (!existsSync(bodyPath)) continue;
    const body = readFileSync(bodyPath, "utf8");
    assert.equal(hasNoExpiredUrl(body), true, item.body);
    for (const phrase of item.phrases) {
      assert.equal(body.includes(phrase), true, `${item.key} ${phrase}`);
    }
    for (const href of item.requiredHrefs ?? []) {
      assert.equal(body.includes(href), true, `${item.key} ${href}`);
    }
    if (item.mermaid) {
      assert.equal(body.includes("```mermaid"), true, item.key);
    }
  }
});
