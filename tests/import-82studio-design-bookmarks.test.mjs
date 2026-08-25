// 82studio 디자인 북마크 임포트 규칙을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  CATEGORY,
  SOURCE_COLLECTION_ID,
  buildTags,
  filterNewItems,
  firstPlain,
  isSameBookmarkUrl,
  notionUrl,
  parseCollection,
  shouldSkipItem,
} from "../scripts/import-82studio-design-bookmarks.mjs";

test("SOURCE collection id와 카테고리 상수는 디자인이다", () => {
  assert.equal(SOURCE_COLLECTION_ID, "3446c679-d11c-81cb-a895-000b3f4e5ded");
  assert.equal(CATEGORY, "디자인");
});

test("Notion URL 속성은 중첩 링크를 이어붙이지 않는다", () => {
  const prop = [["https://example.com/", [["a", "https://example.com/"]]]];
  assert.equal(firstPlain(prop), "https://example.com/");
  assert.equal(notionUrl(prop), "https://example.com/");
  assert.equal(notionUrl(prop).includes("https://example.com/https://"), false);
});

test("URL이 없으면 제외하고 컬렉션 페이지도 제외한다", () => {
  assert.equal(shouldSkipItem({ url: "", title: "Taste skill" }), true);
  assert.equal(shouldSkipItem({ url: "   ", title: "impeccable" }), true);
  assert.equal(
    shouldSkipItem({
      url: "https://example.com/",
      title: "[이제만들시간] 바이브코딩 디자인 참고 사이트 모음",
    }),
    true
  );
  assert.equal(
    shouldSkipItem({ url: "https://example.com/", title: "유니콘 스튜디오" }),
    false
  );
});

test("쿼리와 슬래시만 다른 주소는 같은 북마크로 본다", () => {
  assert.equal(
    isSameBookmarkUrl(
      "https://stitch.withgoogle.com/?pli=1",
      "https://stitch.withgoogle.com/"
    ),
    true
  );
  assert.equal(
    isSameBookmarkUrl("https://ant.design/", "https://ant.design"),
    true
  );
  const { pending, skippedDup } = filterNewItems(
    [
      { title: "Stitch", url: "https://stitch.withgoogle.com/?pli=1" },
      { title: "21st community", url: "https://21st.dev/community/components" },
    ],
    ["https://stitch.withgoogle.com/", "https://21st.dev/"]
  );
  assert.equal(skippedDup.map((item) => item.title).join(","), "Stitch");
  assert.equal(pending.map((item) => item.title).join(","), "21st community");
});

test("태그는 세부유형과 유형을 넣고 디자인 카테고리명은 넣지 않는다", () => {
  const tags = buildTags({
    kind: "레퍼런스",
    details: "앱,웹사이트",
    description: "해외 앱 서비스, 웹사이트 레퍼런스 모여있는 사이트",
  });
  assert.equal(tags.includes("앱"), true);
  assert.equal(tags.includes("웹사이트"), true);
  assert.equal(tags.includes("레퍼런스"), true);
  assert.equal(tags.includes("디자인"), false);
  assert.equal(tags.length <= 6, true);

  const designKind = buildTags({
    kind: "디자인",
    details: "아이콘",
    description: "아이콘 세트",
  });
  assert.equal(designKind.includes("아이콘"), true);
  assert.equal(designKind.includes("디자인"), false);
});

test("세부유형이 비면 한 줄 소개에서 태그를 추론한다", () => {
  const watermelon = buildTags({
    kind: "복사붙여넣기",
    details: "",
    description: "600개 넘는 오픈소스 UI 컴포넌트 모음",
  });
  assert.equal(watermelon.includes("컴포넌트"), true);
  assert.equal(watermelon.includes("오픈소스"), true);
  assert.equal(watermelon.includes("복사붙여넣기"), true);
  assert.equal(watermelon.includes("디자인"), false);

  const aceternity = buildTags({
    kind: "복사붙여넣기",
    details: "",
    description: "200개 이상의 애니메이션 컴포넌트",
  });
  assert.equal(aceternity.includes("애니메이션"), true);
  assert.equal(aceternity.includes("컴포넌트"), true);

  const shapefest = buildTags({
    kind: "복사붙여넣기",
    details: "",
    description: "3D 그래픽/도형 모음",
  });
  assert.equal(shapefest.includes("3D"), true);

  const isms = buildTags({
    kind: "복사붙여넣기",
    details: "",
    description: "요즘 ~이즘 하는 디자인 요소를 적용하고 싶을때 가는 사이트",
  });
  assert.equal(isms.includes("스타일"), true);
  assert.equal(isms.includes("디자인"), false);

  const pen = buildTags({
    kind: "제작",
    details: "",
    description: "피그마 처럼 사용 가능한 바이브 디자인 툴",
  });
  assert.equal(pen.includes("바이브디자인"), true);
  assert.equal(pen.includes("제작"), true);
});

test("컬렉션 파싱은 URL 없는 행과 page가 아닌 블록을 제외한다", () => {
  const payload = {
    result: {
      reducerResults: {
        collection_group_results: {
          blockIds: ["page-ok", "page-nourl", "not-page", "self"],
        },
      },
    },
    recordMap: {
      block: {
        "page-ok": {
          spaceId: "x",
          value: {
            value: {
              type: "page",
              properties: {
                title: [["유니콘 스튜디오"]],
                "f:Bt": [
                  [
                    "https://www.unicorn.studio/",
                    [["a", "https://www.unicorn.studio/"]],
                  ],
                ],
                jIRe: [["있어보이는 모션 그래픽"]],
                "dN]{": [["복사붙여넣기"]],
                "PN}D": [["모션그래픽"]],
              },
            },
            role: "reader",
          },
        },
        "page-nourl": {
          value: {
            value: {
              type: "page",
              properties: {
                title: [["Taste skill"]],
                "dN]{": [["Skill"]],
                "PN}D": [["클로드코드"]],
              },
            },
          },
        },
        "not-page": {
          value: {
            value: {
              type: "collection_view",
              properties: { title: [["뷰"]] },
            },
          },
        },
        self: {
          value: {
            value: {
              type: "page",
              properties: {
                title: [["[이제만들시간] 바이브코딩 디자인 참고 사이트 모음"]],
                "f:Bt": [["https://ignored.example/"]],
              },
            },
          },
        },
      },
    },
  };
  const { items, skippedNoUrl } = parseCollection(payload);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "유니콘 스튜디오");
  assert.equal(items[0].url, "https://www.unicorn.studio/");
  assert.equal(items[0].tags.includes("모션그래픽"), true);
  assert.equal(items[0].tags.includes("복사붙여넣기"), true);
  assert.equal(skippedNoUrl.map((item) => item.title).join(","), "Taste skill");
});
