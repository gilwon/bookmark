// 한국 시간 11월 3일과 4일 Notion 이관 대상을 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SOURCE_URL,
  TARGETS,
  autolinkBareUrls,
  isDuplicateRow,
  preprocessBlocks,
} from "../scripts/import-notion-kst-20261103-04.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20261103-04.mjs"
);

const PAGE_URL = "https://app.notion.com/p/ebeb256827ac8303bfa001270582a88a";
const SKILL_MD =
  "https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 11월 3일과 4일 Notion 신규 글을 Pages에만 저장한다."
  );
});

test("SOURCE_URL에 쿼리와 fbclid가 없다", () => {
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("utm_"), false);
  assert.equal(SOURCE_URL, PAGE_URL);
});

test("대상 1건의 제목과 hex와 이미지 순서가 맞다", () => {
  assert.equal(TARGETS.length, 1);
  const page = TARGETS[0];
  assert.equal(
    page.title,
    "파인드 스킬즈(find-skills) 설치 + 바로 쓰는 질문 예시 40개"
  );
  assert.equal(page.hex, "ebeb256827ac8303bfa001270582a88a");
  assert.equal(page.pageId, "ebeb2568-27ac-8303-bfa0-01270582a88a");
  assert.equal(page.images, 6);
  assert.equal(page.attachments, 0);
  assert.equal(page.root, 121);
  assert.equal(page.tables, 0);
  assert.equal(page.codes, 4);
  assert.deepEqual(page.imageFiles, [
    "nt_board.jpg",
    "nt_skillmd.jpg",
    "nt_readme.jpg",
    "nt_search.jpg",
    "nt_pptx.jpg",
    "nt_repo.jpg",
  ]);
  assert.equal(page.requiredHrefs.includes("https://skills.sh"), true);
  assert.equal(page.requiredHrefs.includes(SKILL_MD), true);
});

test("쿠키 값과 token_v2를 소스에 넣지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes("token_v2"), false);
  assert.equal(source.includes("tmp/notion-kst-20260920/cookies.txt"), true);
});

test("코드 펜스 밖 github http 주소는 https 링크가 된다", () => {
  const out = autolinkBareUrls(
    [
      "```",
      "http://github.com/vercel-labs/skills",
      "```",
      "http://github.com/vercel-labs/skills",
    ].join("\n")
  );
  assert.equal(out.includes("```\nhttp://github.com/vercel-labs/skills\n```"), true);
  assert.equal(
    out.includes(
      "[https://github.com/vercel-labs/skills](https://github.com/vercel-labs/skills)"
    ),
    true
  );
});

test("같은 제목 또는 같은 source_url만 중복이다", () => {
  const title = TARGETS[0].title;
  assert.equal(
    isDuplicateRow(
      {
        title: `${title} 메모`,
        source_url: "https://example.com/other",
      },
      title,
      [SOURCE_URL]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title, source_url: "https://example.com/other" },
      title,
      [SOURCE_URL]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL },
      title,
      [SOURCE_URL]
    ),
    true
  );
});

test("이미지 캡션 링크는 alt 밖으로 빠지고 다음 문단에 남는다", () => {
  const pageId = "page";
  const imageId = "img";
  const blocks = new Map([
    [
      pageId,
      {
        id: pageId,
        type: "page",
        content: [imageId],
        properties: { title: [["제목"]] },
      },
    ],
    [
      imageId,
      {
        id: imageId,
        type: "image",
        content: [],
        properties: {
          title: [["shot.jpg"]],
          caption: [
            ["skills.sh", [["a", "http://skills.sh"]]],
            [" 리더보드"],
          ],
        },
      },
    ],
  ]);
  preprocessBlocks(blocks);
  const image = blocks.get(imageId);
  const caption = image.properties.caption;
  assert.equal(caption.length, 1);
  assert.equal(caption[0][0], "skills.sh 리더보드");
  assert.equal(caption[0][1], undefined);
  const nextId = blocks.get(pageId).content[1];
  const next = blocks.get(nextId);
  assert.equal(next.type, "text");
  assert.equal(next.properties.title[0][1][0][0], "a");
  assert.equal(next.properties.title[0][1][0][1], "http://skills.sh");
});
