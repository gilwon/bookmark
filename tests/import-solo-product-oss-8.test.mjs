// 혼자 프로덕트용 오픈소스 8개 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_IMAGES,
  PAGE_MARKDOWN,
  PAGE_TITLE,
  REPOS,
  isDuplicateTitle,
  linkAttrsOf,
} from "../scripts/import-solo-product-oss-8.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = resolve(root, "scripts/import-solo-product-oss-8.mjs");
const OTHER_TEN_TITLE = "혼자 스타트업 만들 때 저장할 GitHub 10개";

function loadMarkdownToTiptap() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  return markdownToTiptapDoc;
}

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 혼자 프로덕트용 오픈소스 8개를 Pages에만 저장한다"
  );
});

test("저장소 8개 링크가 있고 새 창 속성이 있다", () => {
  assert.equal(PAGE_TITLE, "혼자 프로덕트 만들 때 묶어 둘 오픈소스 8개");
  assert.equal(PAGE_TITLE !== OTHER_TEN_TITLE, true);
  assert.equal(REPOS.length, 8);
  assert.equal(EXPECTED_IMAGES, 0);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(PAGE_MARKDOWN.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(PAGE_MARKDOWN.includes("\uFFFC"), false);
  const markdownToTiptapDoc = loadMarkdownToTiptap();
  const content = JSON.stringify(markdownToTiptapDoc(PAGE_MARKDOWN));
  const links = linkAttrsOf(content);
  for (const repo of REPOS) {
    assert.equal(PAGE_MARKDOWN.includes(repo.href), true, repo.href);
    const hits = links.filter((link) => link.href === repo.href);
    assert.equal(hits.length > 0, true, repo.href);
    for (const hit of hits) {
      assert.equal(hit.target, "_blank", repo.href);
      assert.equal(hit.rel.includes("noopener"), true, repo.href);
    }
  }
});

test("피그마스터와 10선 제목은 이 페이지 중복이 아니다", () => {
  assert.equal(isDuplicateTitle(PAGE_TITLE), true);
  assert.equal(isDuplicateTitle(OTHER_TEN_TITLE), false);
  assert.equal(isDuplicateTitle("[피그마스터] Design.md 뽀개기"), false);
});

test("CATEGORY/Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
});
