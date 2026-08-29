// 2026-08-25 KST Notion 2건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  TARGETS,
  convertTables,
  countImportImages,
  hasNoExpiredUrl,
  isDuplicateRow,
  rewriteImportImages,
} from "../scripts/import-notion-kst-20260825.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stickerBody = readFileSync(
  resolve(root, "tmp/notion-kst-20260825/sticker-clean.md"),
  "utf8"
);
const licenseBody = readFileSync(
  resolve(root, "tmp/notion-kst-20260825/license.md"),
  "utf8"
);

test("대상은 5건이고 skip 3건, 신규는 sticker·license다", () => {
  assert.equal(TARGETS.length, 5);
  assert.deepEqual(
    TARGETS.filter((item) => item.skip).map((item) => item.key),
    ["addon", "apt", "iq"]
  );
  const sticker = TARGETS.find((item) => item.key === "sticker");
  const license = TARGETS.find((item) => item.key === "license");
  assert.equal(Boolean(sticker), true);
  assert.equal(Boolean(license), true);
  assert.equal(sticker.skip, false);
  assert.equal(license.skip, false);
  assert.equal(sticker.hex, "de9b256827ac82a2a2a801c9069a90ae");
  assert.equal(license.hex, "754b256827ac83c69ac401191f3118ab");
  assert.equal(sticker.images, 31);
  assert.equal(license.images, 1);
  assert.equal(license.table, 1);
});

test("정리 본문에 만료 URL이 없고 이미지 경로는 31장·1장이다", () => {
  assert.equal(hasNoExpiredUrl(stickerBody), true);
  assert.equal(hasNoExpiredUrl(licenseBody), true);
  assert.equal(countImportImages(stickerBody), 31);
  assert.equal(countImportImages(licenseBody), 1);
  assert.equal(stickerBody.includes("/imports/notion-kst-20260825/sticker/"), true);
  assert.equal(
    licenseBody.includes("/imports/notion-kst-20260825/license/ds_license_v3.png"),
    true
  );
  assert.equal(stickerBody.includes("prod-files-secure"), false);
  assert.equal(licenseBody.includes("X-Amz"), false);
});

test("스티커·라이선스 이미지 파일이 public/imports 아래에 있다", () => {
  const paths = [
    ...stickerBody.matchAll(
      /!\[[^\]]*\]\((\/imports\/notion-kst-20260825\/[^)]+)\)/g
    ),
    ...licenseBody.matchAll(
      /!\[[^\]]*\]\((\/imports\/notion-kst-20260825\/[^)]+)\)/g
    ),
  ].map((match) => match[1]);
  assert.equal(paths.length, 32);
  for (const src of paths) {
    assert.equal(
      existsSync(resolve(root, "public", src.replace(/^\//, ""))),
      true,
      src
    );
  }
});

test("라이선스 HTML 표는 마크다운 표 헤더로 바뀐다", () => {
  const markdown = convertTables(licenseBody);
  assert.equal(markdown.includes("| 디자인 시스템 |"), true);
  assert.equal(markdown.includes("| --- |"), true);
  assert.equal(markdown.includes("| **SEED** |"), true);
  assert.equal(markdown.includes("<table"), false);
});

test("rewriteImportImages는 독립 줄로 두고 만료 URL이면 중단한다", () => {
  const rewritten = rewriteImportImages(
    "앞\t![](/imports/notion-kst-20260825/sticker/01-8710c66c.png)\n뒤"
  );
  assert.equal(
    rewritten.includes(
      "\n\n![](/imports/notion-kst-20260825/sticker/01-8710c66c.png)\n\n"
    ),
    true
  );
  assert.equal(rewritten.includes("/imports/notion-kst-20260825"), true);
  assert.equal(hasNoExpiredUrl(rewritten), true);
  assert.throws(
    () =>
      rewriteImportImages(
        "![](https://prod-files-secure.s3.us-west-2.amazonaws.com/x?X-Amz-Expires=300)"
      ),
    /만료 서명 URL/
  );
});

test("isDuplicateRow는 제목 또는 hex로 true다", () => {
  const sticker = TARGETS.find((item) => item.key === "sticker");
  assert.equal(
    isDuplicateRow(
      { title: sticker.title, content: "x" },
      sticker.title,
      [sticker.hex, sticker.url]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${sticker.hex}` },
      sticker.title,
      [sticker.hex, sticker.url]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: "없음" },
      sticker.title,
      [sticker.hex, sticker.url]
    ),
    false
  );
});
