// 링크 4건 Pages 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  TARGETS,
  hasNoExpiredUrl,
  isDuplicateRow,
  mediaMime,
  stripTracking,
} from "../scripts/import-pages-20260831.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-pages-20260831.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 웹 3건과 Notion 1건을 Pages에만 저장한다"
  );
});

test("대상은 4건이고 이미지 수는 2·6·0·1이다", () => {
  assert.equal(TARGETS.length, 4);
  assert.deepEqual(
    TARGETS.map((item) => item.key),
    [
      "reborn-rules",
      "jarvis-freebuff",
      "naver-blog-tool",
      "uppinote-session-cleanup",
    ]
  );
  assert.deepEqual(
    TARGETS.map((item) => item.images),
    [2, 6, 0, 1]
  );
});

test("stripTracking은 네 원문의 utm·fbclid·source=copy_link를 뺀다", () => {
  const cases = [
    [
      "https://rebornlabs.kr/rules?utm_source=ig&utm_medium=dm&utm_campaign=prompt&fbclid=IwAR123",
      "https://rebornlabs.kr/rules",
    ],
    [
      "https://jarvisstudio-blog.web.app/blog/freebuff-claude-test/?utm_source=blog&utm_medium=social&fbclid=IwAR123&source=copy_link",
      "https://jarvisstudio-blog.web.app/blog/freebuff-claude-test/",
    ],
    [
      "https://app.notion.com/p/3c9bc8af735e8176970bf2d6070130eb?source=copy_link&utm_source=share&fbclid=IwAR123",
      "https://app.notion.com/p/3c9bc8af735e8176970bf2d6070130eb",
    ],
    [
      "https://uppinote.dev/blog/claude-code-session-cleanup/?utm_source=x&utm_medium=social&utm_campaign=blog&fbclid=IwAR123&source=copy_link",
      "https://uppinote.dev/blog/claude-code-session-cleanup/",
    ],
  ];
  for (const [dirty, clean] of cases) {
    const cleaned = stripTracking(dirty);
    assert.equal(cleaned.includes("fbclid"), false, dirty);
    assert.equal(cleaned.includes("utm_source"), false, dirty);
    assert.equal(cleaned.includes("utm_medium"), false, dirty);
    assert.equal(cleaned.includes("utm_campaign"), false, dirty);
    assert.equal(cleaned.includes("source=copy_link"), false, dirty);
    assert.equal(cleaned, clean);
  }
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
  assert.equal(hasNoExpiredUrl("https://x.com/?utm_source=ig"), false);
});

test("isDuplicateRow는 제목 또는 원문 URL 또는 hex로 true다", () => {
  const reborn = TARGETS.find((item) => item.key === "reborn-rules");
  const notion = TARGETS.find((item) => item.key === "naver-blog-tool");
  assert.equal(Boolean(reborn?.sourceUrl), true);
  assert.equal(Boolean(notion?.hex), true);
  assert.equal(
    isDuplicateRow(
      { title: reborn.title, content: "x" },
      reborn.title,
      [reborn.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${reborn.sourceUrl}` },
      reborn.title,
      [reborn.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: reborn.sourceUrl, content: "없음" },
      reborn.title,
      [reborn.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${notion.hex}` },
      notion.title,
      [notion.pageId, notion.hex, notion.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: "없음" },
      notion.title,
      [notion.hex]
    ),
    false
  );
});
