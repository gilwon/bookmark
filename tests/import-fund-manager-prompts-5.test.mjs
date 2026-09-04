// 펀드매니저 역할 프롬프트 5개를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CATEGORY,
  PROMPTS,
} from "../scripts/import-fund-manager-prompts-5.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-fund-manager-prompts-5.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 펀드매니저 역할 프롬프트 5개를 Prompts에만 저장한다"
  );
});

test("프롬프트는 5개이고 역할·매수 근거 문장이 있다", () => {
  assert.equal(CATEGORY, "투자 · 펀드매니저");
  assert.equal(PROMPTS.length, 5);
  assert.deepEqual(
    PROMPTS.map((prompt) => prompt.title),
    [
      "가치투자 전문 펀드매니저",
      "성장주 투자 전문 펀드매니저",
      "급등주 투자 전문 펀드매니저",
      "모멘텀 투자 전문 펀드매니저",
      "퀀트 투자 전문 펀드매니저",
    ]
  );
  for (const prompt of PROMPTS) {
    assert.equal(prompt.body.includes("펀드매니저다"), true, prompt.title);
    assert.equal(/매수/.test(prompt.body), true, prompt.title);
    assert.equal(/근거/.test(prompt.body), true, prompt.title);
  }
  assert.equal(PROMPTS[0].body.includes("PER, PBR, FCF, ROE"), true);
  assert.equal(PROMPTS[1].body.includes("시장 규모(TAM)"), true);
  assert.equal(PROMPTS[2].body.includes("추격 매수하지 않으며"), true);
  assert.equal(PROMPTS[3].body.includes("상대강도(RS)"), true);
  assert.equal(PROMPTS[4].body.includes("투자 점수를 산출해"), true);
});
