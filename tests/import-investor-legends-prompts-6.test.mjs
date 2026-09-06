// 투자 대가 6인 역할 프롬프트를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CATEGORY,
  PROMPTS,
} from "../scripts/import-investor-legends-prompts-6.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-investor-legends-prompts-6.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 투자 대가 6인 역할 프롬프트를 Prompts에만 저장한다"
  );
});

test("프롬프트는 6개이고 원문 역할·기호가 있다", () => {
  assert.equal(CATEGORY, "투자 · 대가");
  assert.equal(PROMPTS.length, 6);
  assert.deepEqual(
    PROMPTS.map((prompt) => prompt.title),
    [
      "워런 버핏 투자법",
      "피터 린치 투자법",
      "찰리 멍거 투자법",
      "제시 리버모어 투자법",
      "조지 소로스 투자법",
      "존 보글 투자법",
    ]
  );
  for (const prompt of PROMPTS) {
    assert.equal(prompt.body.includes("투자 철학"), true, prompt.title);
    assert.equal(/근거/.test(prompt.body), true, prompt.title);
  }
  assert.equal(PROMPTS[0].body.includes("② 경제적 해자와 경쟁력"), true);
  assert.equal(PROMPTS[0].body.includes("@ 내재가치와 안전마진"), true);
  assert.equal(PROMPTS[1].body.includes("® PER•PEG"), true);
  assert.equal(PROMPTS[2].body.includes("보유할수"), true);
  assert.equal(PROMPTS[3].body.includes("매수 관망•매도"), true);
  assert.equal(PROMPTS[4].body.includes("매수•관망•매도"), true);
  assert.equal(PROMPTS[5].body.includes("① 운용보수와 거래비용"), true);
  assert.equal(PROMPTS[5].body.includes("③ 시장 전체"), true);
});
