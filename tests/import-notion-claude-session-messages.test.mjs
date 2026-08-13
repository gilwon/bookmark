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

function importedEditorContent(source) {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: chatTitle }] },
      { type: "paragraph", content: [{ type: "text", text: "완비된 " }, { type: "text", text: "본문" }] },
      { type: "paragraph", content: [{ type: "text", text: "Notion", marks: [{ type: "link", attrs: { href: source } }] }] },
    ],
  });
}

function editorSavedContent(source) {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "완비된 본문" }] },
      { type: "paragraph", content: [{ type: "text", text: "Notion", marks: [{ type: "link", attrs: { href: source } }] }] },
    ],
  });
}

function structuredContent(source, editorSaved = false) {
  const linkAttrs = editorSaved
    ? { href: source, target: "_blank", rel: "noopener noreferrer nofollow", class: "text-indigo-500 underline underline-offset-2", title: null }
    : { href: source };
  const cellAttrs = editorSaved ? { colspan: 1, rowspan: 1, colwidth: null, align: null } : undefined;
  return JSON.stringify({
    type: "doc",
    content: [
      ...editorSaved ? [] : [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: chatTitle }] }],
      { type: "paragraph", content: editorSaved ? [{ type: "text", text: "완비된 본문" }] : [{ type: "text", text: "완비된 " }, { type: "text", text: "본문" }] },
      { type: "paragraph", content: [{ type: "text", text: "Notion", marks: [{ type: "link", attrs: linkAttrs }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "구조 제목" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "목록" }] }] }] },
      { type: "orderedList", ...(editorSaved ? { attrs: { start: 1, type: null } } : {}), content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "순서" }] }] }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", ...(cellAttrs ? { attrs: cellAttrs } : {}), content: [{ type: "paragraph", content: [{ type: "text", text: "표" }] }] }] }] },
      { type: "codeBlock", attrs: { language: "javascript" }, content: [{ type: "text", text: "const value = 1;" }] },
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

  it("편집기가 선행 제목을 제거하고 text node를 합쳐도 완비 중복은 건너뛴다", () => {
    const normalizedRecord = { ...record, content: importedEditorContent(oldSource), exactDuplicateOnly: true };
    const row = { id: "page-1", title: chatTitle, content: editorSavedContent(newSource) };
    assert.deepEqual(planNotionSessionMessagePage([row], normalizedRecord), { action: "skip", row });
  });

  it("편집기 기본 attrs가 추가돼도 heading·list·table·code 구조가 같으면 건너뛴다", () => {
    const normalizedRecord = { ...record, content: structuredContent(oldSource), exactDuplicateOnly: true };
    const row = { id: "page-1", title: chatTitle, content: structuredContent(newSource, true) };
    assert.deepEqual(planNotionSessionMessagePage([row], normalizedRecord), { action: "skip", row });
  });

  it("텍스트·링크·heading·list·table·code 중 하나라도 손실되면 완비 중복으로 보지 않는다", () => {
    const normalizedRecord = { ...record, content: structuredContent(oldSource), exactDuplicateOnly: true };
    const complete = JSON.parse(structuredContent(newSource, true));
    const damaged = [
      (doc) => { doc.content[0].content[0].text = "누락"; },
      (doc) => { doc.content[1].content[0].marks[0].attrs.href = "https://example.com"; },
      (doc) => { doc.content = doc.content.filter((node) => node.type !== "heading"); },
      (doc) => { doc.content = doc.content.filter((node) => !node.type.endsWith("List")); },
      (doc) => { doc.content = doc.content.filter((node) => node.type !== "table"); },
      (doc) => { doc.content = doc.content.filter((node) => node.type !== "codeBlock"); },
      (doc) => { doc.content.find((node) => node.type === "table").content[0].content[0].attrs.rowspan = 2; },
    ];
    for (const damage of damaged) {
      const doc = structuredClone(complete);
      damage(doc);
      assert.throws(
        () => planNotionSessionMessagePage([{ id: "page-1", title: chatTitle, content: JSON.stringify(doc) }], normalizedRecord),
        /덮어쓰지 않고 중단|제목과 원문 식별자 후보/
      );
    }
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
