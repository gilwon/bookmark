// 용도 칩 분류 파일(installed-tools-tags.json)의 값·개수·누락·접미사 키 규칙과 로더 병합을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import snapshot from "../src/data/installed-tools.json";
import tagsJson from "../src/data/installed-tools-tags.json";
import { TOOL_TAGS, localSnapshot, mergeKo } from "../src/lib/installed-tools";
import { missingTags } from "../scripts/scan-installed-tools.mjs";

const tags = tagsJson as Record<string, string[]>;
const allowed: readonly string[] = TOOL_TAGS;

test("모든 값이 고정 목록 안이고 칩은 1~2개, 중복 없음", () => {
  for (const [key, list] of Object.entries(tags)) {
    assert.ok(list.length >= 1 && list.length <= 2, `${key} 칩 개수 ${list.length}`);
    assert.equal(new Set(list).size, list.length, `${key} 칩 중복`);
    for (const t of list) assert.ok(allowed.includes(t), `${key} 목록 밖 값 ${t}`);
  }
});

test("모든 스킬·플러그인에 분류 키가 있다(누락 0)", () => {
  assert.deepEqual(missingTags(snapshot, tags), []);
});

test("이름이 겹치면 `키/출처` 만, 아니면 `키` 만 둔다. 스냅샷에 없는 키도 없다", () => {
  const expected = new Set<string>();
  for (const t of snapshot.tools) {
    for (const kind of ["skill", "plugin"] as const) {
      const items: { name: string; source?: string; marketplace?: string }[] = t[`${kind}s`];
      for (const i of items) {
        const key = `${t.id}/${kind}/${i.name}`;
        const from = kind === "skill" ? i.source : i.marketplace;
        const dup = items.filter((x) => x.name === i.name).length > 1;
        expected.add(dup ? `${key}/${from}` : key);
        if (dup) assert.ok(!(key in tags), `${key} 는 출처 접미사 키로만 둔다`);
      }
    }
  }
  assert.deepEqual(Object.keys(tags).sort(), [...expected].sort());
});

test("로더가 tags 를 채운다", () => {
  const merged = mergeKo(localSnapshot);
  for (const t of merged.tools) {
    for (const item of [...t.skills, ...t.plugins]) {
      assert.ok(item.tags?.length, `${t.id}/${item.name} tags 비어 있음`);
    }
  }
});
