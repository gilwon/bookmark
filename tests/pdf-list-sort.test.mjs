// 저장된 PDF 목록의 정렬 규칙을 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortSavedPdfs } from "../src/lib/list-utils.ts";

const pdfs = [
  { id: "no-date", name: "라.pdf", createdAt: null },
  { id: "same-date-na", name: "나.pdf", createdAt: "2026-08-03T00:00:00Z" },
  { id: "same-name-old", name: "가.pdf", createdAt: "2026-08-01T00:00:00Z" },
  { id: "same-date-da", name: "다.pdf", createdAt: "2026-08-03T00:00:00Z" },
  { id: "same-name-new", name: "가.pdf", createdAt: "2026-08-02T00:00:00Z" },
];

describe("저장된 PDF 목록 정렬", () => {
  it("기본 이름 가나다순이며 같은 이름은 등록일 최신순으로 정렬한다", () => {
    const sorted = sortSavedPdfs(pdfs);

    assert.deepEqual(
      sorted.map((pdf) => pdf.id),
      ["same-name-new", "same-name-old", "same-date-na", "same-date-da", "no-date"]
    );
    assert.deepEqual(pdfs.map((pdf) => pdf.id), [
      "no-date",
      "same-date-na",
      "same-name-old",
      "same-date-da",
      "same-name-new",
    ]);
  });

  it("등록일 최신순이며 같은 등록일은 이름순, 날짜 누락은 마지막으로 정렬한다", () => {
    assert.deepEqual(
      sortSavedPdfs(pdfs, "created_desc").map((pdf) => pdf.id),
      ["same-date-na", "same-date-da", "same-name-new", "same-name-old", "no-date"]
    );
  });
});
