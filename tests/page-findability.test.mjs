// 페이지 찾기용 평문·태그·원문 URL 추출을 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  PAGE_FAVORITE_COLUMN_USER_MESSAGE,
  buildSearchText,
  extractSourceUrl,
  inferPageTags,
  isMissingPageFindabilityColumn,
  preparePageFindability,
} from "../src/lib/page-findability.ts";

describe("page-findability", () => {
  it("data URL이 search_text에 없다", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8A",
            url: "data:image/png;base64,AAAA_SHOULD_NOT_INDEX",
            title: "본문 검색어",
          },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "평문 키워드" }],
        },
      ],
    };
    const text = buildSearchText("제목", content);
    assert.equal(text.includes("data:image"), false);
    assert.equal(text.includes("AAAA_SHOULD_NOT_INDEX"), false);
    assert.equal(text.includes("data:"), false);
    assert.match(text, /평문 키워드/);
    assert.match(text, /본문 검색어/);
  });

  it("저장소·이미지 URL은 원문으로 쓰지 않는다", () => {
    const md = `![표지](https://rtozdreykeuqlwntulkc.supabase.co/storage/v1/object/public/x.png)

본문 https://example.com/article`;
    const url = extractSourceUrl(md);
    assert.equal(url, "https://example.com/article");
  });

  it("마크다운 원문 링크에서 source_url을 추출하고 fbclid·utm을 제거한다", () => {
    const md = `> 원문. [글](https://worpsense.com/post?utm_source=x&fbclid=abc123&keep=1)`;
    const url = extractSourceUrl(md);
    assert.ok(url);
    assert.equal(url.includes("fbclid"), false);
    assert.equal(url.includes("utm_source"), false);
    assert.ok(url.includes("keep=1"));
    assert.ok(url.includes("worpsense.com/post"));
  });

  it("티탭 원문 링크에서 source_url을 추출하고 fbclid를 제거한다", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "원문",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://gymcoding.co/skill?fbclid=xyz" },
                },
              ],
            },
            {
              type: "text",
              text: "다른",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://example.com/later" },
                },
              ],
            },
          ],
        },
      ],
    };
    const url = extractSourceUrl(doc);
    assert.ok(url);
    assert.equal(url.includes("fbclid"), false);
    assert.ok(url.startsWith("https://gymcoding.co/skill"));
  });

  it("inferPageTags는 짐코딩·워프센스·로고 호스트를 태그한다", () => {
    assert.ok(
      inferPageTags({
        title: "스킬 모음",
        sourceUrl: "https://gymcoding.co/a",
        searchText: "",
      }).includes("짐코딩")
    );
    assert.ok(
      inferPageTags({
        title: "글",
        sourceUrl: "https://worpsense.com/a",
        searchText: "",
      }).includes("Worpsense")
    );
    assert.ok(
      inferPageTags({
        title: "Looka",
        sourceUrl: "https://looka.com/",
        searchText: "",
      }).includes("로고")
    );
  });

  it("기존 태그가 있으면 추론으로 덮지 않는다", () => {
    const result = preparePageFindability({
      title: "짐코딩 스킬",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "원문",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "https://gymcoding.co/x" },
                  },
                ],
              },
            ],
          },
        ],
      },
      existingTags: ["고정"],
      existingSourceUrl: null,
    });
    assert.deepEqual(result.tags, ["고정"]);
    assert.ok(result.sourceUrl?.includes("gymcoding.co"));
    assert.match(result.searchText, /짐코딩/);
  });

  it("is_favorite 컬럼 없음 오류를 가려낸다", () => {
    assert.equal(
      isMissingPageFindabilityColumn(
        'column custom_pages.is_favorite does not exist'
      ),
      true
    );
    assert.equal(
      isMissingPageFindabilityColumn("Could not find the 'is_favorite' column of 'custom_pages' in the schema cache"),
      true
    );
    assert.equal(isMissingPageFindabilityColumn("updatePage timeout"), false);
    assert.equal(
      PAGE_FAVORITE_COLUMN_USER_MESSAGE.includes("is_favorite"),
      true
    );
  });

  it("스크립트 첫 줄이 한글 주석이다", () => {
    const src = readFileSync(
      new URL("../src/lib/page-findability.ts", import.meta.url),
      "utf8"
    );
    assert.match(src.split("\n")[0], /^\/\/ .*[가-힣]/);
    const script = readFileSync(
      new URL("../scripts/backfill-page-findability.mjs", import.meta.url),
      "utf8"
    );
    assert.match(script.split("\n")[0], /^\/\/ .*[가-힣]/);
  });
});
