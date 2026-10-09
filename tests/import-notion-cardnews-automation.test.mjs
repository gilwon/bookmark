// 인스타 카드 뉴스 자동화 노션 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertDownloadableAttachment } from "../scripts/import-claude-eli5-page.mjs";
import {
  COOKIE_RELATIVE,
  SKIPPED_HEXES,
  SPACE_ID,
  TARGETS,
  autolinkBareUrls,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-notion-cardnews-automation.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-cardnews-automation.mjs"
);

const PAGE_HEX = "3f3c52851bfd80dc9a1fe328258ba7c6";
const SOURCE_URL =
  "https://cottony-number-bb7.notion.site/3f3c52851bfd80dc9a1fe328258ba7c6";

const SKIPPED = [
  "285b256827ac829cb58381e6c9409da2",
  "3db98dec8eed8107b5eac827fe906cce",
  "417b256827ac83d09bb7013942b14bef",
  "f7bb256827ac8381be0e81a4cb198bbe",
  "f65b256827ac82bbaa25014f824bab76",
  "9beb256827ac823fb0120170ad07c5b9",
  "ef4b256827ac8250ac8001830bc891b4",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 인스타 카드 뉴스 자동화 사이트 노션 페이지를 Pages에만 저장한다"
  );
});

test("대상 1건의 제목·주소·본문 수가 맞다", () => {
  assert.equal(TARGETS.length, 1);
  assert.deepEqual(TARGETS[0], {
    key: "cardnews",
    title: "[무료배포] 인스타 카드 뉴스 자동화 사이트",
    hex: PAGE_HEX,
    pageId: "3f3c5285-1bfd-80dc-9a1f-e328258ba7c6",
    sourceUrl: SOURCE_URL,
    images: 2,
    attachments: 1,
    root: 64,
    tables: 0,
    codes: 10,
    toDo: 0,
    imageFiles: ["image.png", "image.png"],
    imageBytes: [9907, 308021],
    imageSizes: [
      [532, 193],
      [1344, 853],
    ],
    attachmentName: "cardnews-automation.html",
    attachmentBytes: 50284,
    attachmentMime: "text/html",
    attachmentPrefix: "<!DOCTYPE html",
    phrases: [
      "1단계: 파일 준비하기",
      "2단계: Gemini API 키 발급하기",
      "5단계: 카드뉴스 생성하기",
      "오류 해결 방법",
      "cardnews-automation.html",
    ],
    requiredHrefs: ["https://aistudio.google.com/apikey"],
  });
  assert.equal(TARGETS[0].sourceUrl.includes("?"), false);
  assert.equal(TARGETS[0].sourceUrl.includes("fbclid"), false);
});

test("이 페이지 hex는 스킵 목록에 없다", () => {
  assert.deepEqual([...SKIPPED_HEXES], SKIPPED);
  assert.equal(SKIPPED_HEXES.includes(PAGE_HEX), false);
  assert.equal(
    TARGETS.some((item) => SKIPPED_HEXES.includes(item.hex)),
    false
  );
});

test("stripTracking은 원문 주소의 추적 쿼리를 빼고 물음표도 남기지 않는다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123&source=copy_link`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("?"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("제목이 비슷해도 원문 주소가 다르면 중복이 아니다", () => {
  const spec = TARGETS[0];
  const markers = [spec.sourceUrl, spec.pageId, spec.hex];
  assert.equal(
    isDuplicateRow(
      {
        title: "완전히 다른 페이지",
        source_url: "https://example.com/other",
        content: "",
      },
      spec.title,
      markers
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "인스타 카드 뉴스 자동화",
        source_url: "https://example.com/similar",
        content: "",
      },
      spec.title,
      markers
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      {
        title: spec.title,
        source_url: "https://example.com/other",
        content: "",
      },
      spec.title,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "다른 제목",
        source_url: spec.sourceUrl,
        content: "",
      },
      spec.title,
      markers
    ),
    true
  );
});

test("HTML 첨부는 data URL 링크가 되고 PK 헤더는 거절한다", () => {
  const filename = "cardnews-automation.html";
  const body = "<!DOCTYPE html><p>ok</p>";
  const markdown = assertDownloadableAttachment(
    filename,
    Buffer.from(body, "utf8"),
    "text/html"
  );
  const matched = /^\[([^\]]+)\]\((data:text\/html;base64,[A-Za-z0-9+/=]+)\)$/.exec(
    markdown
  );
  assert.ok(matched);
  assert.equal(matched[1], filename);
  const encoded = matched[2].slice(matched[2].indexOf(",") + 1);
  assert.equal(Buffer.from(encoded, "base64").toString("utf8"), body);
  assert.throws(
    () =>
      assertDownloadableAttachment(
        "note.html",
        Uint8Array.from([0x50, 0x4b, 0x03, 0x04]),
        "text/html"
      ),
    /ZIP/
  );
});

test("코드 펜스 안 http 주소는 https로 바꾸지 않는다", () => {
  const markdown = "```\nhttp://localhost:3000/health\n```\n\nhttp://example.com/a";
  const linked = autolinkBareUrls(markdown);
  assert.equal(linked.includes("http://localhost:3000/health"), true);
  assert.equal(linked.includes("https://localhost"), false);
  assert.equal(linked.includes("[https://example.com/a](https://example.com/a)"), true);
});

test("Prompts 테이블과 행 갱신과 첨부 저장소를 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(source.includes(SPACE_ID), true);
  assert.equal(source.includes(COOKIE_RELATIVE), true);
  assert.equal(SPACE_ID, "bafc5285-1bfd-8131-a532-00039591f1d0");
  assert.equal(COOKIE_RELATIVE, "tmp/notion-kst-20260920/cookies.txt");
  assert.equal(source.includes("https://www.notion.so/api/v3/getSignedFileUrls"), true);
  assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(source), false);
});
