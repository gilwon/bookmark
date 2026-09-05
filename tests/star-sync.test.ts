import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planStarSync } from "../src/lib/star-sync";
import { STAR_LIST_SELECT } from "../src/lib/store/star-list";
import type { GithubStarRow } from "../src/lib/store/types";

function row(over: Partial<GithubStarRow> & Pick<GithubStarRow, "id" | "repoFullName">): GithubStarRow {
  return {
    userId: "u1",
    description: "d",
    language: "ts",
    stars: 1,
    topics: "[]",
    url: "https://github.com/" + over.repoFullName,
    lastSynced: "old",
    createdAt: "c",
    changeKind: null,
    starsDelta: 0,
    changedAt: null,
    source: "sync",
    isFavorite: 0,
    detailJson: "BLOB",
    readmeMd: "README",
    readmeMdKo: "KO",
    detailFetchedAt: "t",
    ...over,
  };
}

const translate = (
  _n: string,
  incoming: string | null,
  existing: string | null
) => incoming ?? existing;

describe("STAR_LIST_SELECT", () => {
  it("README·detail 컬럼을 넣지 않는다", () => {
    assert.equal(STAR_LIST_SELECT.includes("readme_md"), false);
    assert.equal(STAR_LIST_SELECT.includes("detail_json"), false);
  });
});

describe("planStarSync", () => {
  it("첫 동기화는 insert만 하고 뱃지를 달지 않는다", () => {
    const plan = planStarSync({
      userId: "u1",
      repos: [
        {
          repoFullName: "a/b",
          description: "x",
          language: "ts",
          stars: 3,
          topics: [],
          url: "https://github.com/a/b",
        },
      ],
      local: [],
      now: "now",
      newId: () => "id-1",
      translate,
    });
    assert.equal(plan.batch.inserts.length, 1);
    assert.equal(plan.batch.inserts[0]!.changeKind, null);
    assert.equal(plan.batch.updates.length, 0);
    assert.equal(plan.batch.deleteIds.length, 0);
    assert.equal(plan.added, 0);
  });

  it("기존 행은 getStarByRepo 없이 맵으로 갱신한다", () => {
    const plan = planStarSync({
      userId: "u1",
      repos: [
        {
          repoFullName: "A/B",
          description: "new",
          language: "ts",
          stars: 10,
          topics: ["x"],
          url: "https://github.com/A/B",
        },
      ],
      local: [row({ id: "1", repoFullName: "a/b", stars: 1 })],
      now: "now",
      newId: () => "nope",
      translate,
    });
    assert.equal(plan.batch.inserts.length, 0);
    assert.equal(plan.batch.updates.length, 1);
    assert.equal(plan.batch.updates[0]!.id, "1");
    assert.equal(plan.batch.updates[0]!.patch.stars, 10);
    assert.equal(plan.updated, 1);
    assert.equal(plan.starsChanged, 1);
  });

  it("GitHub에 없는 sync 행은 삭제하고 manual은 남긴다", () => {
    const plan = planStarSync({
      userId: "u1",
      repos: [],
      local: [
        row({ id: "s", repoFullName: "gone/repo", source: "sync" }),
        row({ id: "m", repoFullName: "keep/manual", source: "manual" }),
      ],
      now: "now",
      newId: () => "x",
      translate,
    });
    assert.deepEqual(plan.batch.deleteIds, ["s"]);
    assert.deepEqual(plan.removedRepos, ["gone/repo"]);
  });
});
