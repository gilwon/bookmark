// Claude 세션 메시지와 기존 ChatGPT Page의 이관 계획을 검증한다
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planNotionSessionMessagePage } from "../scripts/import-notion-claude-session-messages.mjs";

const chatTitle = "업무시간 단축시켜주는 ChatGPT 프롬프 40가지";
const oldSource = "https://app.notion.com/p/174b256827ac824288c401f5bfcd6224";
const newSource = "https://app.notion.com/p/gilwon/ChatGPT-40-6edb256827ac838abfda01aac69d9b29";

function pageContent(source, text = "완비된 본문") {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text }] },
      { type: "paragraph", content: [{ type: "text", text: "Notion", marks: [{ type: "link", attrs: { href: source } }] }] },
    ],
  });
}

describe("세션 메시지 Notion Page 이관 계획", () => {
  const record = {
    title: chatTitle,
    sourceAliases: [oldSource, newSource],
    content: pageContent(oldSource),
  };

  it("원문 링크 alias만 다른 완비된 기존 ChatGPT Page는 건너뛴다", () => {
    const row = { id: "page-1", title: chatTitle, content: pageContent(newSource) };
    assert.deepEqual(planNotionSessionMessagePage([row], record), { action: "skip", row });
  });

  it("같은 원문 링크를 가진 결손 Page는 갱신한다", () => {
    const row = { id: "page-1", title: chatTitle, content: pageContent(newSource, "다른 본문") };
    assert.deepEqual(planNotionSessionMessagePage([row], record), { action: "update", row });
  });

  it("완비 중복 전용 Page의 본문이 다르면 덮어쓰지 않는다", () => {
    const row = { id: "page-1", title: chatTitle, content: pageContent(newSource, "다른 본문") };
    assert.throws(
      () => planNotionSessionMessagePage([row], { ...record, exactDuplicateOnly: true }),
      /덮어쓰지 않고 중단/
    );
  });

  it("같은 제목이 중복되면 저장 전에 중단한다", () => {
    assert.throws(
      () => planNotionSessionMessagePage([
        { id: "page-1", title: chatTitle, content: pageContent(oldSource) },
        { id: "page-2", title: chatTitle, content: pageContent(oldSource) },
      ], record),
      /제목이 중복/
    );
  });

  it("원문만 일치하는 다른 제목 Page는 신규 저장으로 추측하지 않는다", () => {
    assert.throws(
      () => planNotionSessionMessagePage([
        { id: "page-1", title: "다른 Page", content: pageContent(newSource) },
      ], record),
      /원문 식별자만 일치/
    );
  });

  it("같은 제목이 없는 신규 Page는 삽입한다", () => {
    assert.deepEqual(planNotionSessionMessagePage([], record), { action: "insert", row: null });
  });
});
