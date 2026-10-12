// 2026-10-12 Notion 가이드 2건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildMarkdown } from "../scripts/import-claude-eli5-page.mjs";
import {
  SKIPPED_HEXES,
  TARGETS,
  autolinkBareUrls,
  isDuplicateRow,
  liftFencesOutOfCallouts,
  keepSubtree,
  preprocessBlocks,
} from "../scripts/import-notion-two-20261012.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-two-20261012.mjs"
);

const SHARE_PAGE_ID = "3d2e43a1-6720-803b-96db-e6a060b25ff9";
const SHARE_HEX = "3d2e43a16720803b96dbe6a060b25ff9";
const KAKAO = "https://open.kakao.com/o/g8oGrusi";

test("첫 줄 주석이고 원문 주소에 source=copy_link가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 2026-10-12에 붙여 넣은 Notion 가이드 2건을 Pages에만 저장한다"
  );
  assert.equal(TARGETS.length, 2);
  for (const item of TARGETS) {
    assert.equal(item.sourceUrl.includes("source=copy_link"), false);
    assert.equal(item.sourceUrl.includes("fbclid"), false);
    assert.equal(item.sourceUrl.includes("utm_"), false);
    assert.equal(item.sourceUrl.includes("?"), false);
  }
});

test("대상 2건의 제목과 hex와 개수가 맞다", () => {
  assert.equal(TARGETS.length, 2);
  const lead = TARGETS[0];
  assert.equal(lead.title, "클로드 AI 팀장 켜기 전에, 지시문부터 붙여넣기");
  assert.equal(lead.hex, "3f073c7b15ad8196bfc1e7956a7a1864");
  assert.equal(lead.pageId, "3f073c7b-15ad-8196-bfc1-e7956a7a1864");
  assert.equal(
    lead.sourceUrl,
    "https://app.notion.com/p/3f073c7b15ad8196bfc1e7956a7a1864"
  );
  assert.equal(lead.images, 0);
  assert.equal(lead.attachments, 0);
  assert.equal(lead.tables, 2);
  assert.equal(lead.codes, 5);
  assert.equal(lead.root, 65);
  assert.equal(lead.imageFiles, undefined);
  assert.deepEqual(lead.phrases, ["클로드 새 프로젝트", "용도별 지시문"]);
  assert.deepEqual(lead.requiredHrefs, [
    "https://claude.ai/code",
    "https://claude.com/form/projects",
    "https://code.claude.com/docs/en/claude-projects",
    "https://claude.com/blog/projects-redesigned",
    "https://sebia.ai",
  ]);

  const workflow = TARGETS[1];
  assert.equal(
    workflow.title,
    "[가이드] AI로 나만의 노션 대시보드 만들고 자동화하기 - 전체 워크플로우"
  );
  assert.equal(workflow.hex, "3f3e43a1672080b283a5e5f8ad06a6b9");
  assert.equal(workflow.pageId, "3f3e43a1-6720-80b2-83a5-e5f8ad06a6b9");
  assert.equal(
    workflow.sourceUrl,
    "https://app.notion.com/p/3f3e43a1672080b283a5e5f8ad06a6b9"
  );
  assert.equal(workflow.images, 0);
  assert.equal(workflow.attachments, 0);
  assert.equal(workflow.tables, 4);
  assert.equal(workflow.codes, 6);
  assert.equal(workflow.root, 59);
  assert.equal(workflow.imageFiles, undefined);
  assert.deepEqual(workflow.phrases, ["전체 흐름", "돈 관리 대시보드"]);
  assert.deepEqual(workflow.requiredHrefs, [
    "https://www.instagram.com/beucheo.ai/",
    KAKAO,
  ]);
  assert.equal(SKIPPED_HEXES.includes(lead.hex), false);
  assert.equal(SKIPPED_HEXES.includes(workflow.hex), false);
});

test("비슷한 제목은 중복이 아니고 같은 제목 또는 같은 source_url은 중복이다", () => {
  for (const item of TARGETS) {
    const title = item.title;
    assert.equal(
      isDuplicateRow(
        {
          title: `${title} 메모`,
          source_url: "https://example.com/other",
        },
        title,
        [item.sourceUrl]
      ),
      false
    );
    assert.equal(
      isDuplicateRow(
        { title, source_url: "https://example.com/other" },
        title,
        [item.sourceUrl]
      ),
      true
    );
    assert.equal(
      isDuplicateRow(
        { title: "다른 글", source_url: item.sourceUrl },
        title,
        [item.sourceUrl]
      ),
      true
    );
    assert.equal(isDuplicateRow(null, title, [item.sourceUrl]), false);
  }
  assert.equal(
    isDuplicateRow(
      { title: TARGETS[1].title, source_url: TARGETS[1].sourceUrl },
      TARGETS[0].title,
      [TARGETS[0].sourceUrl]
    ),
    false
  );
});

test("북마크 블록은 카카오 링크 문단이 된다", () => {
  const spec = TARGETS[1];
  const bookmarkId = "bookmark-1";
  const blocks = new Map([
    [
      spec.pageId,
      {
        id: spec.pageId,
        type: "page",
        properties: { title: [[spec.title]] },
        content: [bookmarkId],
      },
    ],
    [
      bookmarkId,
      {
        id: bookmarkId,
        type: "bookmark",
        properties: {
          title: [["부체오 AI 질문방, 프롬프트 공유, 활용법 공유"]],
          link: [[
            `${KAKAO}?utm_source=share&fbclid=IwAR123&source=copy_link&from=dm`,
          ]],
        },
      },
    ],
  ]);
  preprocessBlocks(blocks);
  const kept = keepSubtree(blocks, spec.pageId);
  const { markdown } = buildMarkdown(kept, spec.pageId, spec.sourceUrl, new Map());
  const linked = `[부체오 AI 질문방, 프롬프트 공유, 활용법 공유](${KAKAO})`;
  assert.equal(markdown.includes(linked), true);
  assert.equal(markdown.includes("fbclid"), false);
  assert.equal(markdown.includes("utm_"), false);
  assert.equal(markdown.includes("source=copy_link"), false);
  assert.equal(markdown.includes("from=dm"), false);
});

test("자식 페이지는 링크만 되고 자료 공유 페이지는 펼치지 않는다", () => {
  const spec = TARGETS[0];
  const imageId = "share-image";
  const blocks = new Map([
    [
      spec.pageId,
      {
        id: spec.pageId,
        type: "page",
        properties: { title: [[spec.title]] },
        content: [SHARE_PAGE_ID],
      },
    ],
    [
      SHARE_PAGE_ID,
      {
        id: SHARE_PAGE_ID,
        type: "page",
        properties: { title: [["자료 공유"]] },
        content: [imageId],
      },
    ],
    [
      imageId,
      {
        id: imageId,
        type: "image",
        properties: {
          source: [["https://prod-files-secure.example/secret.png"]],
          title: [["secret.png"]],
        },
      },
    ],
  ]);
  const kept = keepSubtree(blocks, spec.pageId);
  assert.equal(kept.has(SHARE_PAGE_ID), true);
  assert.equal(kept.has(imageId), false);
  const images = [...kept.values()].filter((block) => block.type === "image");
  assert.equal(images.length, 0);
  const { markdown } = buildMarkdown(kept, spec.pageId, spec.sourceUrl, new Map());
  assert.equal(markdown.includes(`https://www.notion.so/${SHARE_HEX}`), true);
  assert.equal(markdown.includes("자료 공유"), true);
  assert.equal(markdown.includes("secret.png"), false);
  assert.equal(markdown.includes("prod-files-secure"), false);
  assert.equal(markdown.includes("data:image/"), false);
});

test("콜아웃 안 코드 펜스는 콜아웃 밖으로 나온다", () => {
  const source = [
    ":::callout",
    "인터뷰 프롬프트",
    "",
    "```text",
    "한 줄",
    "```",
    ":::",
    "",
    "```text",
    "바깥",
    "```",
  ].join("\n");
  const out = liftFencesOutOfCallouts(source);
  assert.equal(out.includes("```text\n한 줄\n```"), true);
  assert.equal(out.includes("```text\n바깥\n```"), true);
  const callouts = [...out.matchAll(/:::callout\n([\s\S]*?)\n:::/g)];
  assert.equal(callouts.length, 1);
  assert.equal(callouts[0][1].includes("```"), false);
  assert.equal(callouts[0][1].includes("인터뷰 프롬프트"), true);
});

test("http://sebia.ai/ 는 https가 되고 코드 펜스 안 localhost는 유지된다", () => {
  const source = [
    "```bash",
    "http://localhost:3000",
    "http://example.com/inside",
    "```",
    "http://sebia.ai/",
    "http://sebia.ai/?utm_source=share&fbclid=abc&source=copy_link&from=dm",
    "http://localhost:4000/health",
  ].join("\n");
  const out = autolinkBareUrls(source);
  assert.equal(out.includes("[https://sebia.ai/](https://sebia.ai/)"), true);
  assert.equal(out.includes("http://sebia.ai/"), false);
  assert.equal(out.includes("http://example.com/inside"), true);
  assert.equal(out.includes("http://localhost:3000"), true);
  assert.equal(out.includes("http://localhost:4000/health"), true);
  assert.equal(out.includes("https://localhost"), false);
  assert.equal(out.includes("fbclid"), false);
  assert.equal(out.includes("utm_"), false);
  assert.equal(out.includes("source=copy_link"), false);
  assert.equal(out.includes("from=dm"), false);
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
  assert.equal(source.includes("cursor.stack"), true);
});
