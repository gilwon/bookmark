// 혼자 스타트업용 GitHub 10선 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PAGE_MARKDOWN,
  PAGE_TITLE,
  REPOS,
  linkAttrsOf,
} from "../scripts/import-solo-startup-github-10.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = resolve(root, "scripts/import-solo-startup-github-10.mjs");
const EDITOR_PATH = resolve(root, "src/components/pages/tiptap-editor.tsx");

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
    "// 혼자 스타트업용 GitHub 저장소 10선을 Pages에만 저장한다"
  );
});

test("저장소 10개 링크가 있고 새 창 속성이 있다", () => {
  assert.equal(PAGE_TITLE, "혼자 스타트업 만들 때 저장할 GitHub 10개");
  assert.equal(REPOS.length, 10);
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

test("에디터 링크는 새 창으로 연다", () => {
  const source = readFileSync(EDITOR_PATH, "utf8");
  assert.equal(source.includes('target: "_blank"'), true);
  assert.equal(source.includes('rel: "noopener noreferrer"'), true);
});
