// Pages 첨부 다운로드 경로의 공개 입력 검증을 확인한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPageAttachmentObjectPath,
  isPageAttachmentFilename,
  isPageAttachmentSourceId,
  planNotionWeekPageAction,
  pageAttachmentDownloadOutcome,
  selectPageAttachmentImportTarget,
} from "../src/lib/page-attachment-storage.ts";

const sourceId = "5a5b256827ac8287b9b381e50f142820";

describe("Pages 첨부 Storage 공개 경계", () => {
  it("두 허용 ZIP의 사용자별 경로를 결정적으로 만든다", () => {
    assert.equal(
      createPageAttachmentObjectPath(
        "github/123",
        sourceId,
        "intranet-style-skill-20260807.zip"
      ),
      "Z2l0aHViLzEyMw/5a5b256827ac8287b9b381e50f142820/intranet-style-skill-20260807.zip"
    );
    assert.equal(
      createPageAttachmentObjectPath(
        "github/123",
        sourceId,
        "ui-inspector-skill-20260807.zip"
      ),
      "Z2l0aHViLzEyMw/5a5b256827ac8287b9b381e50f142820/ui-inspector-skill-20260807.zip"
    );
    assert.equal(
      createPageAttachmentObjectPath(
        "github/123",
        "0e7b256827ac82de8fce8194c7e6a4c7",
        "moodmode-insta-saver.zip"
      ),
      "Z2l0aHViLzEyMw/0e7b256827ac82de8fce8194c7e6a4c7/moodmode-insta-saver.zip"
    );
  });

  it("사용자 폴더를 경로 구분자 없이 분리한다", () => {
    const first = createPageAttachmentObjectPath(
      "github/123",
      sourceId,
      "ui-inspector-skill-20260807.zip"
    );
    const second = createPageAttachmentObjectPath(
      "github/456",
      sourceId,
      "ui-inspector-skill-20260807.zip"
    );
    assert.ok(first);
    assert.ok(second);
    assert.notEqual(first, second);
    assert.doesNotMatch(first.split("/")[0], /[\\/]/);
  });

  it("경로 탈출, 잘못된 sourceId, ZIP 이외 파일을 거절한다", () => {
    assert.equal(isPageAttachmentSourceId(sourceId), true);
    assert.equal(isPageAttachmentSourceId("../5a5b256827ac8287b9b381e50f142820"), false);
    assert.equal(isPageAttachmentSourceId("5a5b256827ac8287b9b381e50f14282"), false);
    assert.equal(isPageAttachmentSourceId("5a5b256827ac8287b9b381e50f142829"), false);
    assert.equal(isPageAttachmentFilename("../archive.zip"), false);
    assert.equal(isPageAttachmentFilename("archive.zip"), false);
    assert.equal(isPageAttachmentFilename("notes.txt"), false);
    assert.equal(
      createPageAttachmentObjectPath(
        "github/123",
        sourceId,
        "moodmode-insta-saver.zip"
      ),
      null
    );
    assert.equal(
      createPageAttachmentObjectPath("github/123", sourceId, "../archive.zip"),
      null
    );
  });
});

describe("김효율 스킬팩 저장 대상 선택", () => {
  const title = "김효율 스킬팩";
  const sourceMarkers = ["5a5b256827ac8287b9b381e50f142820", "3b5003c7f7be80bbb275eda06077f238"];

  it("정확한 제목 한 건만 갱신 대상으로 선택한다", () => {
    const exact = { id: "page-1", title, content: "기존 본문" };
    assert.equal(
      selectPageAttachmentImportTarget(
        [exact, { id: "other", title: "다른 문서", content: "본문" }],
        title,
        sourceMarkers
      ),
      exact
    );
  });

  it("정확한 제목이 중복되면 쓰기 전에 거절한다", () => {
    assert.throws(
      () => selectPageAttachmentImportTarget([
        { id: "page-1", title, content: "첫 본문" },
        { id: "page-2", title, content: "둘째 본문" },
      ], title, sourceMarkers),
      /제목이 중복/
    );
  });

  it("제목 없이 source만 인용한 문서는 이름 변경으로 추측하지 않는다", () => {
    assert.throws(
      () => selectPageAttachmentImportTarget([
        { id: "other", title: "다른 문서", content: "https://app.notion.com/p/gilwon/5a5b256827ac8287b9b381e50f142820" },
      ], title, sourceMarkers),
      /원문 식별자만 일치/
    );
  });

  it("제목과 원문 식별자 후보가 모두 없으면 신규 저장을 선택한다", () => {
    assert.equal(
      selectPageAttachmentImportTarget(
        [{ id: "other", title: "다른 문서", content: "본문" }],
        title,
        sourceMarkers
      ),
      null
    );
  });
});

describe("Pages 첨부 다운로드 Storage 결과", () => {
  it("없는 파일과 Storage 오류를 각각 404와 500으로 계산한다", () => {
    assert.deepEqual(pageAttachmentDownloadOutcome({ status: 404 }, null), {
      status: 404,
    });
    assert.deepEqual(pageAttachmentDownloadOutcome({ status: 500 }, null), {
      status: 500,
    });
  });

  it("서명 URL이 있으면 307 redirect 결과를 계산한다", () => {
    assert.deepEqual(
      pageAttachmentDownloadOutcome(null, "https://storage.example/signed"),
      { status: 307, signedUrl: "https://storage.example/signed" }
    );
    assert.deepEqual(pageAttachmentDownloadOutcome(null, null), { status: 500 });
  });
});

describe("2026년 8월 10일 Notion Page 이관 계획", () => {
  const title = "새 Page";
  const sourceMarkers = ["new-source-id", "https://app.notion.com/p/new-source-id"];

  it("기존 제목이 없으면 삽입을 계획한다", () => {
    assert.deepEqual(
      planNotionWeekPageAction([], title, sourceMarkers, 1, []),
      { action: "insert", row: null }
    );
  });

  it("기존 제목의 미디어가 모자라면 본문 갱신을 계획한다", () => {
    const row = { id: "page-1", title, content: '{"type":"doc"}' };
    assert.deepEqual(
      planNotionWeekPageAction([row], title, sourceMarkers, 1, ["/api/page-attachments/source/file.zip"]),
      { action: "update", row }
    );
  });

  it("기존 제목의 미디어가 완비되면 건너뛴다", () => {
    const row = {
      id: "page-1",
      title,
      content: '{"type":"image"}{"href":"/api/page-attachments/source/file.zip"}',
    };
    assert.deepEqual(
      planNotionWeekPageAction([row], title, sourceMarkers, 1, ["/api/page-attachments/source/file.zip"]),
      { action: "skip", row }
    );
  });

  it("중복 제목과 source-only 후보를 쓰기 전에 거절한다", () => {
    assert.throws(
      () => planNotionWeekPageAction([
        { id: "page-1", title, content: "본문" },
        { id: "page-2", title, content: "본문" },
      ], title, sourceMarkers, 0, []),
      /제목이 중복/
    );
    assert.throws(
      () => planNotionWeekPageAction([
        { id: "other", title: "다른 Page", content: "new-source-id" },
      ], title, sourceMarkers, 0, []),
      /원문 식별자만 일치/
    );
  });
});
