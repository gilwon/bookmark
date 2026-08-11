// 에이전트 문서 중복 판정 지문 함수 테스트
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agentDocId,
  docFingerprint,
  isDuplicateAgentDoc,
  splitDuplicateDrafts,
} from "../src/lib/agent-doc-dedupe.ts";

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

describe("agentDocId", () => {
  it("같은 사용자와 같은 파일 묶음은 같은 ID를 만든다", () => {
    const files = [{ filename: "SKILL.md", content: "hello" }];
    assert.equal(agentDocId("user-a", files), agentDocId("user-a", files));
  });

  it("같은 파일 묶음도 슬롯이 다르면 다른 ID를 만든다", () => {
    const files = [{ filename: "SKILL.md", content: "hello" }];
    assert.equal(agentDocId("user-a", files, 1), agentDocId("user-a", files, 1));
    assert.notEqual(agentDocId("user-a", files, 0), agentDocId("user-a", files, 1));
  });

  it("사용자나 본문이 다르면 다른 ID를 만든다", () => {
    const files = [{ filename: "SKILL.md", content: "hello" }];
    assert.notEqual(agentDocId("user-a", files), agentDocId("user-b", files));
    assert.notEqual(
      agentDocId("user-a", files),
      agentDocId("user-a", [{ filename: "SKILL.md", content: "world" }])
    );
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

describe("isDuplicateAgentDoc", () => {
  it("기존 다중 파일 문서와 같은 파일 묶음을 중복으로 판정한다", () => {
    const existing = [
      [
        { filename: "SKILL.md", content: "---\nname: demo\n---\n" },
        { filename: "AGENTS.md", content: "instructions\n" },
      ],
    ];

    assert.equal(
      isDuplicateAgentDoc(
        [
          { filename: "agents.md", content: "instructions" },
          { filename: "skill.md", content: "\uFEFF---\r\nname: demo\r\n---" },
        ],
        existing
      ),
      true
    );
  });

  it("본문이 다른 문서는 중복으로 판정하지 않는다", () => {
    assert.equal(
      isDuplicateAgentDoc(
        [{ filename: "SKILL.md", content: "new content" }],
        [[{ filename: "skill.md", content: "old content" }]]
      ),
      false
    );
  });
});
