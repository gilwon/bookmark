// 에이전트 문서 중복 판정 지문 함수 테스트
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { docFingerprint, splitDuplicateDrafts } from "../src/lib/agent-doc-dedupe.ts";

describe("docFingerprint", () => {
  it("파일 순서만 다르면 같은 지문", () => {
    const a = docFingerprint([
      { filename: "SKILL.md", content: "hello" },
      { filename: "AGENTS.md", content: "world" },
    ]);
    const b = docFingerprint([
      { filename: "AGENTS.md", content: "world" },
      { filename: "SKILL.md", content: "hello" },
    ]);
    assert.equal(a, b);
  });

  it("CRLF 와 LF 는 같은 지문", () => {
    const a = docFingerprint([{ filename: "a.md", content: "line1\r\nline2" }]);
    const b = docFingerprint([{ filename: "a.md", content: "line1\nline2" }]);
    assert.equal(a, b);
  });

  it("끝 개행 차이는 같은 지문", () => {
    const a = docFingerprint([{ filename: "a.md", content: "hello\n\n" }]);
    const b = docFingerprint([{ filename: "a.md", content: "hello" }]);
    assert.equal(a, b);
  });

  it("본문 한 글자 다르면 다른 지문", () => {
    const a = docFingerprint([{ filename: "a.md", content: "hello" }]);
    const b = docFingerprint([{ filename: "a.md", content: "hellp" }]);
    assert.notEqual(a, b);
  });

  it("파일명 대소문자만 다르면 같은 지문", () => {
    const a = docFingerprint([{ filename: "SKILL.md", content: "hello" }]);
    const b = docFingerprint([{ filename: "skill.md", content: "hello" }]);
    assert.equal(a, b);
  });

  it("BOM 유무만 다르면 같은 지문", () => {
    const a = docFingerprint([{ filename: "a.md", content: "\uFEFFhello" }]);
    const b = docFingerprint([{ filename: "a.md", content: "hello" }]);
    assert.equal(a, b);
  });
});

describe("splitDuplicateDrafts", () => {
  function draft(title, content) {
    return { title, files: [{ filename: "a.md", content }] };
  }

  it("배치 내 동일 지문 2개 중 1개만 남는다", () => {
    const drafts = [draft("첫번째", "hello"), draft("두번째", "hello")];
    const { fresh, duplicateTitles } = splitDuplicateDrafts(drafts, new Set());
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0].title, "첫번째");
    assert.deepEqual(duplicateTitles, ["두번째"]);
  });

  it("기존 지문 집합과 겹치면 제외된다", () => {
    const drafts = [draft("문서", "hello")];
    const existing = new Set([docFingerprint(drafts[0].files)]);
    const { fresh, duplicateTitles } = splitDuplicateDrafts(drafts, existing);
    assert.equal(fresh.length, 0);
    assert.deepEqual(duplicateTitles, ["문서"]);
  });

  it("제목이 없으면 파일명이 쓰인다", () => {
    const drafts = [draft("", "hello"), draft("", "hello")];
    const { duplicateTitles } = splitDuplicateDrafts(drafts, new Set());
    assert.deepEqual(duplicateTitles, ["a.md"]);
  });
});
