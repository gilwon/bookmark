// tuemarz LLM 카운슬 노션 이관 헬퍼를 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  COOKIE_RELATIVE,
  SPACE_ID,
  TARGET,
  autolinkBareUrls,
  isDuplicateRow,
  restoreCaptionLinks,
  stripTracking,
} from "../scripts/import-tuemarz-llm-council.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-tuemarz-llm-council.mjs"
);
const SOURCE_URL =
  "https://tuemarz.notion.site/LLM-400137c926d581cfb48dfa836bf7a8dd";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// tuemarz 공개 Notion LLM 카운슬 설치 가이드를 Pages에만 저장한다."
  );
});

test("대상은 공개 페이지 1건이고 추적 쿼리가 없다", () => {
  assert.equal(TARGET.title, "카파시의 자문단(LLM 카운슬) 설치 가이드");
  assert.equal(TARGET.hex, "400137c926d581cfb48dfa836bf7a8dd");
  assert.equal(TARGET.pageId, "400137c9-26d5-81cf-b48d-fa836bf7a8dd");
  assert.equal(TARGET.sourceUrl, SOURCE_URL);
  assert.equal(TARGET.sourceUrl.includes("?"), false);
  assert.equal(TARGET.images, 6);
  assert.equal(TARGET.attachments, 0);
  assert.equal(TARGET.tables, 2);
  assert.equal(TARGET.codes, 3);
  assert.equal(TARGET.dividers, 7);
  assert.equal(TARGET.root, 59);
  assert.deepEqual(TARGET.imageFiles, [
    "01_karpathy.jpg",
    "02_llm_council.jpg",
    "03_skill_repo.jpg",
    "04_five_advisors.jpg",
    "06_skill_upload.jpg",
    "05_result.jpg",
  ]);
  assert.equal(
    TARGET.imageBytes.reduce((sum, size) => sum + size, 0),
    836831
  );
  assert.equal(SPACE_ID, "44b9d169-a795-4d3d-a9a9-bf9ab8070759");
  assert.equal(COOKIE_RELATIVE, "tmp/notion-kst-20260920/cookies.txt");
});

test("stripTracking은 추적 쿼리만 빼고 본문 링크는 유지한다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123&source=copy_link&pvs=1`;
  assert.equal(stripTracking(dirty), SOURCE_URL);
  assert.equal(stripTracking("http://skill.md/"), "https://skill.md/");
  assert.equal(
    stripTracking("http://claude.ai/new#customize/skills"),
    "https://claude.ai/new#customize/skills"
  );
  assert.equal(
    stripTracking("http://localhost:3000/health"),
    "http://localhost:3000/health"
  );
  assert.equal(
    stripTracking("https://www.youtube.com/@builderjoshkim?sub_confirmation=1"),
    "https://www.youtube.com/@builderjoshkim?sub_confirmation=1"
  );
  assert.equal(
    stripTracking("https://x.com/someone/status/1?s=46"),
    "https://x.com/someone/status/1"
  );
  assert.equal(
    stripTracking("https://www.instagram.com/reel/Dewga9usbsU/?igsh=abc"),
    "https://www.instagram.com/reel/Dewga9usbsU"
  );
  assert.equal(
    stripTracking("https://example.com/path?from=dm"),
    "https://example.com/path"
  );
});

test("제목이나 원문 주소가 같을 때만 중복이다", () => {
  assert.equal(
    isDuplicateRow(
      { title: "다른 제목", source_url: "https://example.com/other" },
      TARGET.title,
      TARGET.sourceUrl
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: TARGET.title, source_url: "https://example.com/other" },
      TARGET.title,
      TARGET.sourceUrl
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 제목", source_url: TARGET.sourceUrl },
      TARGET.title,
      TARGET.sourceUrl
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "다른 제목",
        source_url: "https://example.com/other",
        content: TARGET.hex,
      },
      TARGET.title,
      TARGET.sourceUrl
    ),
    false
  );
});

test("코드 펜스 안 http 주소는 바꾸지 않는다", () => {
  const markdown = "```\nhttp://localhost:3000/health\n```\n\nhttp://skill.md/";
  const linked = autolinkBareUrls(markdown);
  assert.equal(linked.includes("http://localhost:3000/health"), true);
  assert.equal(linked.includes("https://localhost"), false);
  assert.equal(linked.includes("[https://skill.md/](https://skill.md/)"), true);
});

test("이미지 캡션의 링크는 alt에서 빠지고 다음 문단으로 남는다", () => {
  const alt = "SKILL.md에 적힌 다섯 자문";
  const markdown = `![${alt}](data:image/jpeg;base64,YQ==)\n`;
  const restored = restoreCaptionLinks(markdown, [
    {
      alt,
      caption: "[SKILL.md](http://skill.md/)에 적힌 다섯 자문",
    },
  ]);
  const linked = autolinkBareUrls(restored);
  assert.equal(linked.includes(`![${alt}](data:image/jpeg;base64,YQ==)`), true);
  assert.equal(linked.includes("[SKILL.md](https://skill.md/)"), true);
  assert.equal(linked.includes("]!("), false);
});

test("Prompts 테이블과 행 갱신을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update({"), false);
  assert.equal(source.includes(".upsert("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(source.includes(".or("), false);
  assert.equal(source.includes("c9f63792-cf01-4ae9-982a-b4c0bb0f97a7"), false);
  assert.equal(
    source.includes(
      "process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)"
    ),
    true
  );
});
