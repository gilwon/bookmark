// 링크 5건 Pages 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  TARGETS,
  hasNoExpiredUrl,
  isDuplicateRow,
  mediaMime,
  resolvedTitle,
  stripTracking,
} from "../scripts/import-pages-20260829.mjs";

test("대상은 5건이고 qjc는 skip이다", () => {
  assert.equal(TARGETS.length, 5);
  const qjc = TARGETS.find((item) => item.key === "qjc");
  assert.equal(Boolean(qjc), true);
  assert.equal(qjc.skip, true);
  assert.equal(
    TARGETS.filter((item) => item.skip).map((item) => item.key).join(),
    "qjc"
  );
});

test("stripTracking은 qjc 추적 쿼리를 뺀다", () => {
  const cleaned = stripTracking(
    "https://qjc.app/blog/chatgpt-scheduled-tasks-free?utm_source=fb&utm_medium=cpc&fbclid=IwAR123&mcp_token=abc&source=copy_link"
  );
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("utm_medium"), false);
  assert.equal(cleaned.includes("mcp_token"), false);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned, "https://qjc.app/blog/chatgpt-scheduled-tasks-free");
});

test("resolvedTitle은 빈 문자열이면 fallback을 쓴다", () => {
  assert.equal(
    resolvedTitle(
      "",
      "🟨 홈피드 체류형 블로그 콘텐츠 생성 프롬프트 (최종 완성본)"
    ),
    "🟨 홈피드 체류형 블로그 콘텐츠 생성 프롬프트 (최종 완성본)"
  );
  assert.equal(resolvedTitle("   ", "폴백 제목"), "폴백 제목");
  assert.equal(resolvedTitle("실제 제목", "폴백 제목"), "실제 제목");
});

test("mediaMime은 SVG 바이트를 image/svg+xml로 둔다", () => {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>`
  );
  assert.equal(mediaMime(svg, "application/octet-stream"), "image/svg+xml");
  const xml = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"></svg>`
  );
  assert.equal(mediaMime(xml, "text/plain"), "image/svg+xml");
});

test("만료 URL 문자열이 본문에 없으면 true다", () => {
  assert.equal(hasNoExpiredUrl("# 제목\n\n본문입니다."), true);
  assert.equal(
    hasNoExpiredUrl("https://prod-files-secure.s3.us-west-2.amazonaws.com/x"),
    false
  );
  assert.equal(hasNoExpiredUrl("https://file.notion.so/f"), false);
  assert.equal(hasNoExpiredUrl("https://example.com/?X-Amz-Signature=1"), false);
  assert.equal(hasNoExpiredUrl("expirationTimestamp=1"), false);
  assert.equal(hasNoExpiredUrl("blob:https://example.com/1"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?fbclid=IwAR"), false);
});

test("isDuplicateRow는 제목 또는 hex로 true다", () => {
  const notepolio = TARGETS.find((item) => item.key === "notepolio");
  assert.equal(Boolean(notepolio?.hex), true);
  assert.equal(
    isDuplicateRow(
      { title: notepolio.title, content: "x" },
      notepolio.title,
      [notepolio.hex]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${notepolio.hex}` },
      notepolio.title,
      [notepolio.pageId, notepolio.hex, notepolio.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: "없음" },
      notepolio.title,
      [notepolio.hex]
    ),
    false
  );
});
