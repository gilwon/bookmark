// 목록 SELECT 컬럼과 Star 상한
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  BOOKMARK_IMPORT_SELECT,
  COPY_LIST_SELECT,
  PROMPT_LIST_SELECT,
} from "../src/lib/store/star-list";

function readMaxStarredRepos(): number {
  // octokit 패키지 export 때문에 github.ts를 로드하지 않고 상수만 읽는다
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/lib/github.ts"),
    "utf8"
  );
  const match = src.match(/export const MAX_STARRED_REPOS = (\d+)/);
  assert.ok(match, "MAX_STARRED_REPOS 선언이 없다");
  return Number(match[1]);
}

describe("목록 SELECT", () => {
  it("PROMPT_LIST_SELECT에 sections를 넣지 않는다", () => {
    assert.equal(PROMPT_LIST_SELECT.includes("sections"), false);
  });

  it("COPY_LIST_SELECT에 body를 넣지 않는다", () => {
    assert.equal(COPY_LIST_SELECT.includes("body"), false);
  });

  it("BOOKMARK_IMPORT_SELECT에 tags를 넣지 않는다", () => {
    assert.equal(BOOKMARK_IMPORT_SELECT.includes("tags"), false);
  });
});

describe("MAX_STARRED_REPOS", () => {
  it("3000이고 0보다 크다", () => {
    const MAX_STARRED_REPOS = readMaxStarredRepos();
    assert.equal(MAX_STARRED_REPOS, 3000);
    assert.ok(MAX_STARRED_REPOS > 0);
  });
});
