// 북마크 카테고리를 상위 그룹 키로 접는 규칙을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PC_BOOKMARK_GROUP,
  SITE_GROUP,
  UNCATEGORIZED_GROUP,
  bookmarkGroupKey,
  bookmarkGroupLabel,
  bookmarkInGroup,
} from "../src/lib/bookmark-groups.ts";

test("PC 북마크/무료폰트 → PC 북마크", () => {
  assert.equal(bookmarkGroupKey("PC 북마크/무료폰트"), "PC 북마크");
  assert.equal(bookmarkGroupKey("PC 북마크/무료폰트"), PC_BOOKMARK_GROUP);
});

test("raycast.com → 사이트", () => {
  assert.equal(bookmarkGroupKey("raycast.com"), "사이트");
  assert.equal(bookmarkGroupKey("raycast.com"), SITE_GROUP);
});

test("디자인 → 디자인", () => {
  assert.equal(bookmarkGroupKey("디자인"), "디자인");
});

test("배포 · 호스팅 → 배포 · 호스팅", () => {
  assert.equal(bookmarkGroupKey("배포 · 호스팅"), "배포 · 호스팅");
});

test("빈 값 → 미분류", () => {
  assert.equal(bookmarkGroupKey(""), UNCATEGORIZED_GROUP);
  assert.equal(bookmarkGroupKey("   "), UNCATEGORIZED_GROUP);
  assert.equal(bookmarkGroupKey(null), UNCATEGORIZED_GROUP);
  assert.equal(bookmarkGroupKey(undefined), UNCATEGORIZED_GROUP);
  assert.equal(bookmarkGroupKey(""), "미분류");
});

test("korean.visitkorea.or.kr → 사이트", () => {
  assert.equal(bookmarkGroupKey("korean.visitkorea.or.kr"), SITE_GROUP);
});

test("nicelydone.club → 사이트", () => {
  assert.equal(bookmarkGroupKey("nicelydone.club"), SITE_GROUP);
});

test("PC 북마크 정확 일치도 같은 그룹이다", () => {
  assert.equal(bookmarkGroupKey("PC 북마크"), PC_BOOKMARK_GROUP);
});

test("점이 없는 카테고리는 사이트로 오인하지 않는다", () => {
  assert.equal(bookmarkGroupKey("AI 정보"), "AI 정보");
  assert.equal(bookmarkGroupKey("프로그램"), "프로그램");
});

test("그룹 표시 이름과 소속 판정이 키와 맞다", () => {
  assert.equal(bookmarkGroupLabel(SITE_GROUP), "사이트");
  assert.equal(bookmarkGroupLabel(PC_BOOKMARK_GROUP), "PC 북마크");
  assert.equal(bookmarkInGroup("PC 북마크/AI", PC_BOOKMARK_GROUP), true);
  assert.equal(bookmarkInGroup("raycast.com", SITE_GROUP), true);
  assert.equal(bookmarkInGroup("디자인", SITE_GROUP), false);
});
