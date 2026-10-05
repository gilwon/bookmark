// 설치 현황 용도 필터(parseTag·hasTag)와 URL 쿼리 구성(installedToolsQuery)을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import { hasTag, installedToolsQuery, parseTag } from "../src/lib/installed-tools";

test("목록 안의 용도만 받고 나머지는 선택 없음으로 본다", () => {
  assert.equal(parseTag("개발"), "개발");
  assert.equal(parseTag("디자인·UI"), "디자인·UI");
  assert.equal(parseTag("없는용도"), undefined);
  assert.equal(parseTag(""), undefined);
  assert.equal(parseTag(undefined), undefined);
  assert.equal(parseTag(["개발"]), undefined);
});

test("용도 미선택이면 모두 통과, 선택하면 tags 에 있는 항목만", () => {
  assert.equal(hasTag(undefined, undefined), true);
  assert.equal(hasTag(["개발"], undefined), true);
  assert.equal(hasTag(["개발", "보안·검수"], "보안·검수"), true);
  assert.equal(hasTag(["개발"], "기타"), false);
  assert.equal(hasTag(undefined, "개발"), false);
  assert.equal(hasTag([], "개발"), false);
});

test("쿼리는 기본 정렬과 미선택 용도를 빼고 나머지를 함께 담는다", () => {
  assert.equal(installedToolsQuery("claude", "name"), "tool=claude");
  assert.equal(installedToolsQuery("claude", "uses"), "tool=claude&sort=uses");
  const withTag = new URLSearchParams(installedToolsQuery("codex", "source", "디자인·UI"));
  assert.equal(withTag.get("tool"), "codex");
  assert.equal(withTag.get("sort"), "source");
  assert.equal(withTag.get("tag"), "디자인·UI");
  const nameWithTag = new URLSearchParams(installedToolsQuery("grok", "name", "기타"));
  assert.equal(nameWithTag.has("sort"), false);
  assert.equal(nameWithTag.get("tag"), "기타");
});
