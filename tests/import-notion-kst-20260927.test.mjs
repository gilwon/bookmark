// 한국 시간 이번 주 Notion 신규 2건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PAGE_ATTACHMENT_AI_BERKSHIRE_FILENAME,
  PAGE_ATTACHMENT_AI_BERKSHIRE_SOURCE_ID,
} from "../src/lib/page-attachment-storage.ts";
import {
  BERKSHIRE_IMAGE_FILES,
  BERKSHIRE_ZIP,
  EXPECTED_IMAGES,
  SKIPPED_HEXES,
  TARGETS,
  berkshireAttachmentHref,
  stripTracking,
  verifyBerkshireZip,
} from "../scripts/import-notion-kst-20260927.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20260927.mjs"
);
const SKIPPED_PAGE_HEX = "285b256827ac829cb58381e6c9409da2";
const MENTION_ONLY_HEX = "3db98dec8eed8107b5eac827fe906cce";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 이번 주 Notion 신규 2건을 Pages에만 저장한다"
  );
});

test("대상 2건의 키·이미지·첨부 수가 맞다", () => {
  assert.equal(TARGETS.length, 2);
  const berkshire = TARGETS.find((item) => item.key === "berkshire");
  const tools = TARGETS.find((item) => item.key === "company-tools");
  assert.ok(berkshire);
  assert.ok(tools);
  assert.equal(
    berkshire.title,
    "버핏 AI 4명한테 내 종목 물어보기 (AI 버크셔 설치 가이드)"
  );
  assert.equal(berkshire.hex, "417b256827ac83d09bb7013942b14bef");
  assert.equal(berkshire.pageId, "417b2568-27ac-83d0-9bb7-013942b14bef");
  assert.equal(
    berkshire.sourceUrl,
    "https://app.notion.com/p/417b256827ac83d09bb7013942b14bef"
  );
  assert.equal(berkshire.sourceUrl.includes("source=copy_link"), false);
  assert.equal(berkshire.images, 7);
  assert.equal(berkshire.attachments, 1);
  assert.equal(berkshire.root, 51);
  assert.deepEqual(berkshire.imageFiles, BERKSHIRE_IMAGE_FILES);
  assert.deepEqual(berkshire.phrases, ["STEP 1", "SK하이닉스"]);
  assert.equal(berkshire.requiredHrefs.includes("https://github.com/xbtlin/ai-berkshire"), true);
  assert.equal(berkshire.requiredHrefs.includes("https://www.instagram.com/moodmode.ai"), true);
  assert.equal(berkshire.requiredHrefs.includes(berkshireAttachmentHref()), true);
  assert.equal(
    tools.title,
    "AI 회사 일곱 곳이 사내에서 쓰던 도구를 공짜로 풀었습니다"
  );
  assert.equal(tools.hex, "f7bb256827ac8381be0e81a4cb198bbe");
  assert.equal(tools.pageId, "f7bb2568-27ac-8381-be0e-81a4cb198bbe");
  assert.equal(tools.sourceUrl, "https://app.notion.com/p/f7bb256827ac8381be0e81a4cb198bbe");
  assert.equal(tools.images, 0);
  assert.equal(tools.attachments, 0);
  assert.equal(tools.root, 191);
  assert.equal(tools.tables, 7);
  assert.equal(tools.codes, 9);
  assert.deepEqual(EXPECTED_IMAGES, { berkshire: 7, "company-tools": 0 });
  for (const href of [
    "https://github.com/openai/symphony",
    "https://github.com/xai-org/x-algorithm",
    "https://github.com/NVIDIA/personaplex",
    "https://github.com/anthropics/financial-services",
    "https://github.com/cloudflare/cloudflare-os",
    "https://github.com/Tencent-Hunyuan/Hunyuan3D-2",
    "https://github.com/QwenLM/Qwen3-TTS",
    "https://wandering-mile-86e.notion.site/AI-50-6-88-3db98dec8eed8107b5eac827fe906cce",
  ]) {
    assert.equal(tools.requiredHrefs.includes(href), true, href);
  }
});

test("이미 있는 285b hex와 멘션 전용 hex는 대상이 아니다", () => {
  assert.deepEqual(SKIPPED_HEXES, [SKIPPED_PAGE_HEX, MENTION_ONLY_HEX]);
  const hexes = TARGETS.map((item) => item.hex);
  for (const hex of SKIPPED_HEXES) {
    assert.equal(hexes.includes(hex), false, hex);
  }
  const titles = TARGETS.map((item) => item.title);
  assert.equal(
    titles.includes(
      "AI 직원 7명으로 콘텐츠 팀 만들기 — 폴더 구조 · 직원 7명 프롬프트 · 30분 설치"
    ),
    false
  );
});

test("stripTracking은 source=copy_link를 빼고 http를 https로 바꾼다", () => {
  const berkshire = TARGETS.find((item) => item.key === "berkshire");
  const dirty = `${berkshire.sourceUrl}?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("pvs"), false);
  assert.equal(cleaned, berkshire.sourceUrl);
  assert.equal(stripTracking("http://github.com/xbtlin/ai-berkshire"), "https://github.com/xbtlin/ai-berkshire");
  assert.equal(
    stripTracking("https://www.instagram.com/moodmode.ai/?utm_source=ig"),
    "https://www.instagram.com/moodmode.ai"
  );
  assert.equal(stripTracking(berkshireAttachmentHref()), berkshireAttachmentHref());
  assert.equal(
    berkshireAttachmentHref(),
    `/api/page-attachments/${BERKSHIRE_ZIP.sourceId}/${encodeURIComponent(BERKSHIRE_ZIP.filename)}`
  );
});

test("ZIP 바이트가 기대값과 다르면 throw한다", () => {
  assert.equal(BERKSHIRE_ZIP.bytes, 274316);
  assert.equal(
    BERKSHIRE_ZIP.sha256,
    "84075130ad4e6ec2cd1e89bc0b1a602ecd33830c853aaabedf65cc7bad8f75f8"
  );
  assert.equal(BERKSHIRE_ZIP.filename, "AI버크셔_plugin.zip");
  assert.equal(BERKSHIRE_ZIP.filename.normalize("NFC"), BERKSHIRE_ZIP.filename);
  assert.notEqual(BERKSHIRE_ZIP.filename.normalize("NFD"), BERKSHIRE_ZIP.filename);
  assert.equal(BERKSHIRE_ZIP.sourceId, PAGE_ATTACHMENT_AI_BERKSHIRE_SOURCE_ID);
  assert.equal(BERKSHIRE_ZIP.filename, PAGE_ATTACHMENT_AI_BERKSHIRE_FILENAME);
  assert.equal(BERKSHIRE_ZIP.blockId, "0f0b2568-27ac-82ae-9102-814c8d137898");
  assert.equal(BERKSHIRE_ZIP.attachmentId, "cc6abd21-5c1a-4665-b106-eb4488a011b8");
  const shortZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  assert.throws(() => verifyBerkshireZip(shortZip), /무결성/);
  const wrongSize = new Uint8Array(BERKSHIRE_ZIP.bytes);
  wrongSize[0] = 0x50;
  wrongSize[1] = 0x4b;
  wrongSize[2] = 0x03;
  wrongSize[3] = 0x04;
  assert.throws(() => verifyBerkshireZip(wrongSize), /무결성/);
  const notZip = new Uint8Array(BERKSHIRE_ZIP.bytes);
  notZip.fill(1);
  assert.throws(() => verifyBerkshireZip(notZip), /무결성/);
});

test("CATEGORY/Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
  assert.equal(source.includes("data:application/zip"), true);
  assert.equal(source.includes("useS3Url: true"), true);
});
