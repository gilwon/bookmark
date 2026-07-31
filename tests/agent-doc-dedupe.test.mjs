// 에이전트 문서 중복 판정 지문 함수 테스트
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { docFingerprint } from "../src/lib/agent-doc-dedupe.ts";

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
});
