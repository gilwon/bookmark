// 제목 없는 카피 백필 대상과 스킵 규칙을 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  TARGETS,
  nextPatch,
  tagsAreEmpty,
} from "../scripts/backfill-copy-titles-tags.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = resolve(root, "scripts/backfill-copy-titles-tags.mjs");

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 제목 없는 카피에 본문 기준 제목과 태그를 채운다"
  );
});

test("대상 18건은 id가 겹치지 않고 태그는 2~3개다", () => {
  assert.equal(TARGETS.length, 18);
  const ids = TARGETS.map((item) => item.id);
  assert.equal(new Set(ids).size, 18);
  for (const item of TARGETS) {
    assert.equal(item.id.length, 36);
    assert.ok(item.title.trim().length > 0, item.id);
    assert.equal(item.title.endsWith(":"), false, item.title);
    assert.match(item.title, /[가-힣]/);
    assert.equal(/^\d+[./]/.test(item.title), false, item.title);
    assert.equal(item.title.startsWith("—"), false, item.title);
    assert.ok(item.tags.length >= 2 && item.tags.length <= 3, item.title);
    assert.ok(item.phrase.length > 4, item.id);
  }
});

test("태그가 이미 있으면 덮어쓰지 않는다", () => {
  const target = TARGETS[0];
  assert.equal(tagsAreEmpty("[]"), true);
  assert.equal(tagsAreEmpty("null"), true);
  assert.equal(tagsAreEmpty([]), true);
  assert.equal(tagsAreEmpty("[\"툴\"]"), false);
  assert.deepEqual(
    nextPatch(null, target),
    { action: "missing" }
  );
  assert.equal(
    nextPatch({ body: "다른 본문", tags: "[]" }, target).action,
    "mismatch"
  );
  assert.equal(
    nextPatch(
      { body: `앞 ${target.phrase} 뒤`, tags: "[\"툴\"]" },
      target
    ).action,
    "skip"
  );
  const update = nextPatch(
    { body: `앞 ${target.phrase} 뒤`, tags: "[]" },
    target
  );
  assert.equal(update.action, "update");
  assert.equal(update.title, target.title);
  assert.equal(update.tags, JSON.stringify(target.tags));
});

test("본문 첫 줄이 제목이던 신규 4건의 제목과 태그를 정한다", () => {
  const expected = {
    "a513f878-83bd-4152-bc52-64853748bfcb": {
      title: "비개발자용 사이트 중간 점검 체크리스트",
      tags: ["SEO", "설정"],
    },
    "ed6d8d3c-ab67-43da-83cd-fab88c9f5cc0": {
      title: "플러터 앱 출시 자동화 프롬프트 4개",
      tags: ["프롬프트", "자동화"],
    },
    "2079628e-74c3-4039-b0d9-0df50a9a7e1f": {
      title: "인형집 스킨케어 캐릭터 3D 웹앱 프롬프트",
      tags: ["프롬프트", "디자인"],
    },
    "03786b49-e66b-4b40-a22b-3cc44eaa38e8": {
      title: "항공권 최저가 잡는 ChatGPT 프롬프트 5개",
      tags: ["GPT", "프롬프트"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 4);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
  }
});
