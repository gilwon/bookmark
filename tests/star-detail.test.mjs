// GitHub Star 상세 정규화·README URL 재작성·GitHub fetch를 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  README_MAX_CHARS,
  capReadme,
  fetchGithubRepoDetail,
  parseStarDetailJson,
  rewriteReadmeUrls,
  serializeStarDetailJson,
  splitRepoFullName,
} from "../src/lib/star-detail.ts";

describe("splitRepoFullName", () => {
  it("유효한 owner/repo를 분리한다", () => {
    assert.deepEqual(splitRepoFullName("vercel/next.js"), {
      owner: "vercel",
      repo: "next.js",
    });
    assert.deepEqual(splitRepoFullName("  owner/repo  "), {
      owner: "owner",
      repo: "repo",
    });
  });

  it("잘못된 형식은 null이다", () => {
    assert.equal(splitRepoFullName(""), null);
    assert.equal(splitRepoFullName("only"), null);
    assert.equal(splitRepoFullName("a/b/c"), null);
    assert.equal(splitRepoFullName("owner/"), null);
    assert.equal(splitRepoFullName("/repo"), null);
  });
});

describe("capReadme", () => {
  it("상한을 넘으면 자른다", () => {
    assert.equal(capReadme("abcdef", 3), "abc");
    assert.equal(capReadme("abc", 3), "abc");
    assert.equal(capReadme("abc", 10), "abc");
  });

  it("기본 상한은 30만 자다", () => {
    assert.equal(README_MAX_CHARS, 300_000);
    const s = "x".repeat(README_MAX_CHARS + 5);
    assert.equal(capReadme(s).length, README_MAX_CHARS);
  });
});

describe("rewriteReadmeUrls", () => {
  it("상대 이미지와 문서 링크를 재작성한다", () => {
    const md = "![x](./img.png)\n[doc](docs/a.md)";
    const out = rewriteReadmeUrls(md, "o", "r", "main");
    assert.equal(
      out.includes(
        "https://raw.githubusercontent.com/o/r/main/img.png"
      ),
      true
    );
    assert.equal(
      out.includes("https://github.com/o/r/blob/main/docs/a.md"),
      true
    );
  });

  it("https와 해시 링크는 그대로 둔다", () => {
    const md = "[abs](https://example.com/a)\n[sec](#install)";
    const out = rewriteReadmeUrls(md, "o", "r", "main");
    assert.equal(out, md);
  });
});

describe("parseStarDetailJson / serializeStarDetailJson", () => {
  it("null·잘못된 JSON은 null이다", () => {
    assert.equal(parseStarDetailJson(null), null);
    assert.equal(parseStarDetailJson(undefined), null);
    assert.equal(parseStarDetailJson(""), null);
    assert.equal(parseStarDetailJson("not json"), null);
    assert.equal(parseStarDetailJson("[]"), null);
  });

  it("유효한 JSON을 파싱한다", () => {
    const parsed = parseStarDetailJson(
      JSON.stringify({
        homepage: "https://ex.com",
        license: "MIT",
        defaultBranch: "main",
        forks: 2,
        openIssues: 3,
        watchers: 4,
        pushedAt: "2024-01-01T00:00:00Z",
      })
    );
    assert.deepEqual(parsed, {
      homepage: "https://ex.com",
      license: "MIT",
      defaultBranch: "main",
      forks: 2,
      openIssues: 3,
      watchers: 4,
      pushedAt: "2024-01-01T00:00:00Z",
    });
  });

  it("직렬화 왕복이 같다", () => {
    const detail = {
      homepage: null,
      license: "Apache-2.0",
      defaultBranch: "master",
      forks: 1,
      openIssues: 0,
      watchers: 8,
      pushedAt: null,
    };
    const raw = serializeStarDetailJson(detail);
    assert.deepEqual(parseStarDetailJson(raw), detail);
  });
});

describe("fetchGithubRepoDetail", () => {
  it("레포·README 200이면 재작성된 마크다운을 돌려준다", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/readme")) {
        return new Response("# Hi\n\n![x](./img.png)\n[doc](docs/a.md)", {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          homepage: "https://example.com",
          license: { spdx_id: "MIT", name: "MIT License" },
          default_branch: "master",
          forks_count: 1,
          open_issues_count: 2,
          subscribers_count: 3,
          pushed_at: "2024-01-01T00:00:00Z",
          description: "desc",
          language: "TS",
          stargazers_count: 10,
          topics: ["a"],
          html_url: "https://github.com/o/r",
        }),
        { status: 200 }
      );
    };
    try {
      const result = await fetchGithubRepoDetail("o/r");
      assert.equal(result.defaultBranch, "master");
      assert.equal(result.detail.license, "MIT");
      assert.equal(result.detail.forks, 1);
      assert.equal(result.stars, 10);
      assert.equal(
        result.readmeMd.includes(
          "https://raw.githubusercontent.com/o/r/master/img.png"
        ),
        true
      );
      assert.equal(
        result.readmeMd.includes(
          "https://github.com/o/r/blob/master/docs/a.md"
        ),
        true
      );
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("README 404면 빈 마크다운이다", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/readme")) {
        return new Response("missing", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          default_branch: "main",
          stargazers_count: 0,
          html_url: "https://github.com/o/r",
        }),
        { status: 200 }
      );
    };
    try {
      const result = await fetchGithubRepoDetail("o/r");
      assert.equal(result.readmeMd, "");
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("레포 404면 던진다", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () => new Response("no", { status: 404 });
    try {
      await assert.rejects(
        () => fetchGithubRepoDetail("o/missing"),
        /레포를 찾을 수 없습니다/
      );
    } finally {
      globalThis.fetch = orig;
    }
  });
});
