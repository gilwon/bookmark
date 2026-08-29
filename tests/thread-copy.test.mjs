// 스레드 카피 제목·태그·출처 URL 헬퍼와 검색 타입 라벨
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SEARCH_TYPE_LABEL } from "../src/lib/command-palette-results.ts";
import {
  isMissingThreadCopiesTable,
  normalizeSourceUrl,
  parseCopyTags,
  titleFromCopyBody,
} from "../src/lib/thread-copy.ts";

describe("titleFromCopyBody", () => {
  it("명시 제목이 있으면 본문보다 우선한다", () => {
    assert.equal(
      titleFromCopyBody("첫 줄\n둘째 줄", "명시 제목"),
      "명시 제목"
    );
  });

  it("제목이 비면 본문에서 비어 있지 않은 첫 줄을 쓴다", () => {
    assert.equal(titleFromCopyBody("\n\n  실제 첫 줄\n두번째", ""), "실제 첫 줄");
    assert.equal(titleFromCopyBody("한 줄만"), "한 줄만");
  });

  it("본문도 비면 제목 없는 카피다", () => {
    assert.equal(titleFromCopyBody(""), "제목 없는 카피");
    assert.equal(titleFromCopyBody("  \n  "), "제목 없는 카피");
    assert.equal(titleFromCopyBody("", "   "), "제목 없는 카피");
  });

  it("제목은 200자로 자른다", () => {
    const long = "가".repeat(250);
    assert.equal(titleFromCopyBody("본문", long).length, 200);
    assert.equal(titleFromCopyBody(long).length, 200);
    assert.equal(titleFromCopyBody(long), "가".repeat(200));
  });
});

describe("parseCopyTags", () => {
  it("JSON 배열 문자열을 파싱한다", () => {
    assert.deepEqual(parseCopyTags('["a","b"]'), ["a", "b"]);
  });

  it("쉼표 구분 문자열을 나눈다", () => {
    assert.deepEqual(parseCopyTags("a, b, c"), ["a", "b", "c"]);
  });

  it("배열 입력을 다듬는다", () => {
    assert.deepEqual(parseCopyTags(["x", " y ", 1, ""]), ["x", "y"]);
  });

  it("빈 값은 빈 배열이다", () => {
    assert.deepEqual(parseCopyTags(""), []);
    assert.deepEqual(parseCopyTags(null), []);
    assert.deepEqual(parseCopyTags(undefined), []);
  });
});

describe("normalizeSourceUrl", () => {
  it("앞뒤 공백을 제거하고 빈 값은 null이다", () => {
    assert.equal(normalizeSourceUrl("  https://x.com/a  "), "https://x.com/a");
    assert.equal(normalizeSourceUrl("  "), null);
    assert.equal(normalizeSourceUrl(""), null);
    assert.equal(normalizeSourceUrl(null), null);
  });
});

describe("SEARCH_TYPE_LABEL", () => {
  it('copy 라벨은 "카피"다', () => {
    assert.equal(SEARCH_TYPE_LABEL.copy, "카피");
  });
});

describe("isMissingThreadCopiesTable", () => {
  it("스키마 캐시 부재 메시지를 알아본다", () => {
    assert.equal(
      isMissingThreadCopiesTable(
        "Could not find the table 'public.thread_copies' in the schema cache"
      ),
      true
    );
    assert.equal(isMissingThreadCopiesTable("bookmarks missing"), false);
  });
});
