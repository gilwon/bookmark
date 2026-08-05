// PDF Storage 업로드 메타와 소유 경로 입력 검증을 확인한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_PDF_STORAGE_BYTES,
  createPdfObjectName,
  isPdfStorageId,
  parsePdfObjectName,
  pdfUserFolder,
  validatePdfUploadMeta,
} from "../src/lib/pdf-storage.ts";

describe("PDF Storage 공개 경계", () => {
  it("유효한 PDF 메타를 허용한다", () => {
    assert.equal(
      validatePdfUploadMeta({
        name: "문서.pdf",
        type: "application/pdf",
        size: MAX_PDF_STORAGE_BYTES,
      }),
      null
    );
  });

  it("20MB 초과 파일과 PDF가 아닌 파일을 거절한다", () => {
    assert.match(
      validatePdfUploadMeta({
        name: "큰 문서.pdf",
        type: "application/pdf",
        size: MAX_PDF_STORAGE_BYTES + 1,
      }),
      /20MB/
    );
    assert.match(
      validatePdfUploadMeta({
        name: "문서.txt",
        type: "text/plain",
        size: 100,
      }),
      /PDF/
    );
  });

  it("서버 UUID만 저장 파일 식별자로 허용한다", () => {
    assert.equal(isPdfStorageId("b48c8e0d-5de8-46e7-bfc5-1c8fca9cbc9d"), true);
    assert.equal(isPdfStorageId("../other-user/file"), false);
    assert.equal(isPdfStorageId("b48c8e0d-5de8-16e7-bfc5-1c8fca9cbc9d"), false);
  });

  it("사용자별로 다르고 경로 구분자가 없는 폴더 키를 만든다", () => {
    const first = pdfUserFolder("github/123");
    const second = pdfUserFolder("github/456");
    assert.notEqual(first, second);
    assert.doesNotMatch(first, /[\\/]/);
    assert.equal(first, pdfUserFolder("github/123"));
  });

  it("원본 파일명을 경로 안전한 object name으로 왕복한다", () => {
    const id = "b48c8e0d-5de8-46e7-bfc5-1c8fca9cbc9d";
    const objectName = createPdfObjectName(id, "한글 문서 #1?.pdf");
    assert.ok(objectName);
    assert.doesNotMatch(objectName, /[\\/?#%]/);
    assert.deepEqual(parsePdfObjectName(objectName), {
      id,
      name: "한글 문서 #1?.pdf",
    });
  });

  it("잘못된 object name과 UTF-8 255바이트 초과 이름을 거절한다", () => {
    const id = "b48c8e0d-5de8-46e7-bfc5-1c8fca9cbc9d";
    assert.equal(parsePdfObjectName(`${id}--%%%`), null);
    assert.match(
      validatePdfUploadMeta({
        name: `${"😀".repeat(255)}.pdf`,
        type: "application/pdf",
        size: 100,
      }),
      /파일명/
    );
  });
});
