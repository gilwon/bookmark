// 한국 시간 10월 17일 Notion 인솜니아 가이드 이관 헬퍼를 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildMarkdown } from "../scripts/import-claude-eli5-page.mjs";
import {
  SOURCE_URL,
  TARGETS,
  autolinkBareUrls,
  isDuplicateRow,
  keepSubtree,
  preprocessBlocks,
} from "../scripts/import-notion-kst-20261017.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20261017.mjs"
);

const SYNC_REFERENCE_ID = "cf4b2568-27ac-8201-a87f-816c0f68460a";
const SYNC_CONTAINER_ID = "28e424ad-49f3-8096-a3fc-d35052d86a85";
const COLLECTION_PAGE_ID = "28e424ad-49f3-8064-b2c2-ea4785b23cbe";
const COLLECTION_HEX = "28e424ad49f38064b2c2ea4785b23cbe";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 10월 17일 Notion 인솜니아 가이드를 Pages에만 저장한다."
  );
});

test("SOURCE_URL에 쿼리와 fbclid가 없다", () => {
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("utm_"), false);
  assert.equal(
    SOURCE_URL,
    "https://app.notion.com/p/da7b256827ac8248ac298138648f1b39"
  );
});

test("대상 1건의 제목과 hex와 본문 수가 맞다", () => {
  assert.equal(TARGETS.length, 1);
  const item = TARGETS[0];
  assert.equal(item.key, "insomnia");
  assert.equal(
    item.title,
    "맥북 덮개 닫아도 AI는 계속된다 — 인솜니아(Insomnia) 설치·사용 가이드"
  );
  assert.equal(item.hex, "da7b256827ac8248ac298138648f1b39");
  assert.equal(item.pageId, "da7b2568-27ac-8248-ac29-8138648f1b39");
  assert.equal(item.sourceUrl, SOURCE_URL);
  assert.equal(item.images, 0);
  assert.equal(item.attachments, 0);
  assert.equal(item.tables, 9);
  assert.equal(item.codes, 3);
  assert.equal(item.root, 56);
  assert.equal(item.imageFiles, undefined);
  assert.deepEqual(item.phrases, [
    "왜 필요한가요",
    "설치 전 꼭 확인하세요",
    "설치 방법",
    "사용법",
    "공식 링크 모음",
  ]);
  assert.deepEqual(item.requiredHrefs, [
    "https://github.com/krishhgg/Insomnia",
    "https://github.com/krishhgg/Insomnia/releases/tag/v0.1.0",
    "https://github.com/krishhgg/Insomnia/blob/main/docs/install.md",
    "https://support.apple.com/en-us/102336",
  ]);
});

test("비슷한 제목은 중복이 아니고 같은 제목 또는 같은 source_url은 중복이다", () => {
  const title = TARGETS[0].title;
  assert.equal(
    isDuplicateRow(
      {
        title: `${title} 메모`,
        source_url: "https://example.com/other",
        content: SOURCE_URL,
      },
      title,
      [SOURCE_URL]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title, source_url: "https://example.com/other", content: "다름" },
      title,
      [SOURCE_URL]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL, content: "없음" },
      title,
      [SOURCE_URL]
    ),
    true
  );
  assert.equal(isDuplicateRow(null, title, [SOURCE_URL]), false);
});

test("북마크와 빈 동기화 참조는 컨테이너 자식과 추적 없는 링크를 남긴다", () => {
  const pageId = TARGETS[0].pageId;
  const bookmarkId = "bookmark-1";
  const textA = "text-a";
  const dividerId = "divider-1";
  const textB = "text-b";
  const calloutId = "callout-1";
  const foreignImageId = "foreign-image";
  const blocks = new Map([
    [
      pageId,
      {
        id: pageId,
        type: "page",
        properties: { title: [[TARGETS[0].title]] },
        content: [bookmarkId, SYNC_REFERENCE_ID],
      },
    ],
    [
      bookmarkId,
      {
        id: bookmarkId,
        type: "bookmark",
        properties: {
          link: [[
            "https://github.com/morluto/rea?utm_source=share&fbclid=IwAR123&from=dm",
          ]],
        },
      },
    ],
    [
      SYNC_REFERENCE_ID,
      {
        id: SYNC_REFERENCE_ID,
        type: "transclusion_reference",
        content: [],
        format: {
          transclusion_reference_pointer: { id: SYNC_CONTAINER_ID },
        },
      },
    ],
    [
      SYNC_CONTAINER_ID,
      {
        id: SYNC_CONTAINER_ID,
        type: "transclusion_container",
        content: [textA, dividerId, textB, calloutId],
      },
    ],
    [
      textA,
      {
        id: textA,
        type: "text",
        properties: { title: [["왜 쓰나요"]] },
      },
    ],
    [dividerId, { id: dividerId, type: "divider" }],
    [
      textB,
      {
        id: textB,
        type: "text",
        properties: { title: [["참고한 자료"]] },
      },
    ],
    [
      calloutId,
      {
        id: calloutId,
        type: "callout",
        properties: { title: [["바로 쓰는 문장 여덟 개"]] },
      },
    ],
    [
      "other-page",
      {
        id: "other-page",
        type: "page",
        properties: { title: [["다른 페이지"]] },
        content: [foreignImageId],
      },
    ],
    [
      foreignImageId,
      {
        id: foreignImageId,
        type: "image",
        properties: { source: [["https://prod-files-secure.example/secret.png"]] },
      },
    ],
  ]);
  preprocessBlocks(blocks);
  assert.deepEqual(blocks.get(SYNC_REFERENCE_ID).content, [
    textA,
    dividerId,
    textB,
    calloutId,
  ]);
  const kept = keepSubtree(blocks, pageId);
  assert.equal(kept.has(foreignImageId), false);
  const { markdown } = buildMarkdown(kept, pageId, SOURCE_URL, new Map());
  assert.equal(markdown.includes("https://github.com/morluto/rea"), true);
  assert.equal(markdown.includes("fbclid"), false);
  assert.equal(markdown.includes("utm_"), false);
  assert.equal(markdown.includes("from=dm"), false);
  assert.equal(markdown.includes("왜 쓰나요"), true);
  assert.equal(markdown.includes("참고한 자료"), true);
  assert.equal(markdown.includes("바로 쓰는 문장 여덟 개"), true);
  assert.equal(markdown.includes("prod-files-secure"), false);
});

test("자식 페이지는 링크만 되고 그 안의 이미지는 변환 대상이 아니다", () => {
  const pageId = TARGETS[0].pageId;
  const imageId = "collection-image";
  const blocks = new Map([
    [
      pageId,
      {
        id: pageId,
        type: "page",
        properties: { title: [[TARGETS[0].title]] },
        content: [COLLECTION_PAGE_ID],
      },
    ],
    [
      COLLECTION_PAGE_ID,
      {
        id: COLLECTION_PAGE_ID,
        type: "page",
        properties: { title: [["[후피디] AI 아바타 가이드"]] },
        content: [imageId],
      },
    ],
    [
      imageId,
      {
        id: imageId,
        type: "image",
        properties: {
          source: [["attachment:block:avatar.png"]],
          title: [["avatar.png"]],
        },
      },
    ],
  ]);
  const kept = keepSubtree(blocks, pageId);
  assert.equal(kept.has(COLLECTION_PAGE_ID), true);
  assert.equal(kept.has(imageId), false);
  const images = [...kept.values()].filter((block) => block.type === "image");
  assert.equal(images.length, 0);
  const { markdown } = buildMarkdown(kept, pageId, SOURCE_URL, new Map());
  assert.equal(
    markdown.includes(`https://www.notion.so/${COLLECTION_HEX}`),
    true
  );
  assert.equal(markdown.includes("[후피디] AI 아바타 가이드"), true);
  assert.equal(markdown.includes("avatar.png"), false);
  assert.equal(markdown.includes("data:image/"), false);
});

test("코드 펜스 안 주소는 그대로 두고 localhost는 https로 올리지 않는다", () => {
  const source = [
    "```bash",
    "http://localhost:3000",
    "http://example.com/inside",
    "https://github.com/morluto/rea",
    "```",
    "http://example.com/docs?utm_source=x&fbclid=abc&from=dm",
    "http://localhost:4000/health",
  ].join("\n");
  const out = autolinkBareUrls(source);
  assert.equal(out.includes("http://localhost:3000"), true);
  assert.equal(out.includes("https://localhost"), false);
  assert.equal(out.includes("http://example.com/inside"), true);
  assert.equal(out.includes("https://github.com/morluto/rea"), true);
  assert.equal(
    out.includes("[https://example.com/docs](https://example.com/docs)"),
    true
  );
  assert.equal(out.includes("fbclid"), false);
  assert.equal(out.includes("from=dm"), false);
  assert.equal(out.includes("utm_"), false);
  assert.equal(out.includes("http://localhost:4000/health"), true);
  assert.equal(out.includes("https://localhost:4000"), false);
});

test("Prompts 테이블과 갱신과 첨부 저장소를 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(
    source.includes("https://www.notion.so/api/v3/getSignedFileUrls"),
    true
  );
  assert.equal(source.includes("savedOnBothSides"), true);
  assert.equal(source.includes("local.pages === 1"), true);
  assert.equal(
    source.includes("이번 실행에서 넣은 로컬 행만 지운다. 원래 있던 행은 남긴다."),
    true
  );
});
