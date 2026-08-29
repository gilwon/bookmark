// PromptLib 271건 임포트 스크립트의 매핑·중복판정 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CATEGORY_PREFIX,
  SNAPSHOT_PATH,
  dedupeKey,
  toPromptRow,
} from "../scripts/import-promptlib-oootool.mjs";

const items = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));

test("스냅샷은 271건이고 id가 유일하다", () => {
  assert.equal(items.length, 271);
  const ids = new Set(items.map((item) => item.id));
  assert.equal(ids.size, 271);
});

test("toPromptRow는 카테고리 접두어를 붙이고 대화 시작 예시가 있으면 섹션 2개를 만든다", () => {
  const now = "2026-08-30T00:00:00.000Z";
  const item = items.find((entry) => (entry.conversationStarters ?? []).length > 0);
  const row = toPromptRow(item, "dev", now);
  assert.equal(row.category, `${CATEGORY_PREFIX} · ${item.category}`);
  assert.equal(row.title, item.title.trim());
  assert.equal(row.summary, item.description);
  assert.equal(row.is_favorite, 0);
  const sections = JSON.parse(row.sections);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].title, "프롬프트");
  assert.equal(sections[0].body, item.instructions);
  assert.equal(sections[1].title, "대화 시작 예시");
  assert.equal(sections[1].body, item.conversationStarters.join("\n"));
});

test("capabilities가 빈 배열이면 whenToUse는 null이다", () => {
  const now = "2026-08-30T00:00:00.000Z";
  const item = items.find((entry) => Array.isArray(entry.capabilities) && entry.capabilities.length === 0);
  assert.ok(item, "capabilities 빈 배열 항목이 스냅샷에 있어야 한다");
  const row = toPromptRow(item, "dev", now);
  assert.equal(row.when_to_use, null);
});

test("dedupeKey는 제목이 같아도 본문이 다르면 서로 다른 키를 만든다", () => {
  const now = "2026-08-30T00:00:00.000Z";
  const byKey = new Map();
  for (const item of items) {
    const key = `${item.title}||${item.category}`;
    (byKey.get(key) ?? byKey.set(key, []).get(key)).push(item);
  }
  const [pairA, pairB] = byKey.get("카피라이터 2.0||마케팅");
  const rowA = toPromptRow(pairA, "dev", now);
  const rowB = toPromptRow(pairB, "dev", now);
  assert.equal(rowA.title, rowB.title);
  assert.notEqual(dedupeKey(rowA), dedupeKey(rowB));
});
