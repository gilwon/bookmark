// 다솔인 그록봇 스냅샷 710건의 개수·중복·카테고리를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORY_ORDER,
  EXPECTED_COUNT,
  SOURCE_URL,
  loadCatalog,
} from "../scripts/import-grokbot-templates.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-grokbot-templates.mjs"
);

const items = loadCatalog();

describe("그록봇 템플릿 스냅샷", () => {
  it("스크립트 첫 줄은 한글 역할 주석이다", () => {
    const source = readFileSync(SCRIPT_PATH, "utf8");
    assert.equal(
      source.split("\n")[0],
      "// 다솔인 그록봇 공개 템플릿 710개를 grok_bots에 넣는다"
    );
  });

  it("항목이 710개다", () => {
    assert.equal(items.length, 710);
    assert.equal(EXPECTED_COUNT, 710);
  });

  it("templateUrl이 유일하다", () => {
    const urls = items.map((item) => item.templateUrl);
    assert.equal(new Set(urls).size, urls.length);
  });

  it("이름과 templateUrl이 비어 있지 않다", () => {
    for (const item of items) {
      assert.ok(String(item.name ?? "").trim(), "name");
      assert.ok(String(item.templateUrl ?? "").trim(), "templateUrl");
    }
  });

  it("카테고리 건수가 다솔인 공개 페이지와 같다", () => {
    const counts = {};
    for (const item of items) {
      const c = item.category;
      counts[c] = (counts[c] ?? 0) + 1;
    }
    assert.equal(counts["공식 마켓플레이스"], 71);
    assert.equal(counts["어시스턴트"], 99);
    assert.equal(counts["엔지니어링"], 118);
    assert.equal(counts["리서치"], 56);
    assert.equal(counts["세일즈·마케팅"], 63);
    assert.equal(counts["금융·비용"], 72);
    assert.equal(counts["크리에이티브"], 84);
    assert.equal(counts["개인·생활"], 147);
    assert.deepEqual(CATEGORY_ORDER, [
      "공식 마켓플레이스",
      "어시스턴트",
      "엔지니어링",
      "리서치",
      "세일즈·마케팅",
      "금융·비용",
      "크리에이티브",
      "개인·생활",
    ]);
  });

  it("SOURCE_URL은 다솔인 그록봇 페이지다", () => {
    assert.equal(SOURCE_URL, "https://dasolin.net/tips/grokbot-templates");
  });
});
