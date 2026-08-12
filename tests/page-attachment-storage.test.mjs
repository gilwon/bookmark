// Pages 첨부 다운로드 경로의 공개 입력 검증을 확인한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPageAttachmentObjectPath,
  isPageAttachmentFilename,
  isPageAttachmentSourceId,
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
      createPageAttachmentObjectPath("github/123", sourceId, "../archive.zip"),
      null
    );
  });
});
