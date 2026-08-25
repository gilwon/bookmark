// 관련 페이지·북마크 점수 규칙을 검증한다
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickRelatedBookmarks,
  pickRelatedPages,
  relatedScore,
} from "../src/lib/page-related.ts";

describe("page-related", () => {
  it("호스트가 같으면 www를 무시하고 점수를 준다", () => {
    const page = {
      id: "a",
      title: "Alpha",
      sourceUrl: "https://www.example.com/post",
    };
    const others = [
      { id: "b", title: "Beta", sourceUrl: "https://example.com/other" },
    ];
    const picked = pickRelatedPages(page, others);
    assert.equal(picked.length, 1);
    assert.equal(picked[0].id, "b");
    assert.equal(
      relatedScore({
        pageTitle: page.title,
        pageSourceUrl: page.sourceUrl,
        otherTitle: others[0].title,
        otherUrl: others[0].sourceUrl,
      }),
      3
    );
  });

  it("자기 자신은 제외한다", () => {
    const page = {
      id: "a",
      title: "Same Title Token",
      sourceUrl: "https://ex.com/one",
    };
    const picked = pickRelatedPages(page, [
      page,
      { id: "b", title: "Same Title Token", sourceUrl: "https://ex.com/two" },
    ]);
    assert.deepEqual(
      picked.map((p) => p.id),
      ["b"]
    );
  });

  it("점수 0은 제외한다", () => {
    const page = {
      id: "a",
      title: "Alpha",
      sourceUrl: "https://a.example/x",
    };
    const others = [
      { id: "b", title: "Zzz", sourceUrl: "https://b.example/y" },
    ];
    assert.deepEqual(pickRelatedPages(page, others), []);
    assert.deepEqual(
      pickRelatedBookmarks(page, [
        { id: "bm", title: "Nope", url: "https://other.test/z", category: null },
      ]),
      []
    );
  });
});
