// Claude ELI5 설명이 Stars 목록과 안전한 독립 HTML에 표시되는지 확인한다.
import assert from "node:assert/strict";
import test from "node:test";
import guides from "../src/data/star-claude-eli5.json";
import { getClaudeStarGuide, renderClaudeStarGuide } from "../src/lib/star-claude-eli5";
import { rowToGithubStar } from "../src/lib/star-mapper";
import type { GithubStarRow } from "../src/lib/store/types";

const fixture = {
  summary: "프로그램을 작은 작업 상자 안에서 켜요.",
  steps: [
    { icon: "⌨️", label: "명령 입력", text: "프로그램을 켜 달라고 해요." },
    { icon: "📦", label: "작업 상자", text: "상자 안에서 실행해요." },
    { icon: "💬", label: "완료", text: "터미널에 hello가 나와요." },
  ],
  install: "설치 명령을 실행해요.",
  installCommand: "brew install --cask libracoder/kiri/kiri",
  usage: "터미널에서 hello가 나오는지 봐요.",
  usageCommand: 'printf "<script>&\'\n"',
  source: "https://example.org/docs?a=1&b=2",
};

test("독립 HTML은 그림, 설치·사용 명령, 안전한 출처를 보여 준다", () => {
  const html = renderClaudeStarGuide("<repo>", fixture);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<h1>&lt;repo&gt;<\/h1>/);
  assert.match(html, /data-eli5-diagram/);
  assert.equal((html.match(/<li>/g) ?? []).length, 3);
  assert.match(html, /id="install".*brew install/);
  assert.match(html, /id="usage".*printf .*&lt;script&gt;&amp;&#39;/);
  assert.match(html, /href="https:\/\/example\.org\/docs\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /<script>|<(?:iframe|link|img)\b/);
  for (const source of ["javascript:alert(1)", "http://example.org", "https://name:pass@example.org", "//example.org"]) {
    assert.doesNotMatch(renderClaudeStarGuide("kiri", { ...fixture, source }), /<a href=/);
  }
});

test("목록·상세 모델은 Claude 설명이 있는 저장소에만 한국어 요약을 적용한다", () => {
  const repo = Object.keys(guides)[0];
  assert.ok(repo);
  const guide = getClaudeStarGuide(repo.toUpperCase());
  assert.ok(guide?.summary);
  assert.equal(getClaudeStarGuide("__proto__"), undefined);
  const row: GithubStarRow = {
    id: "star", userId: "user", repoFullName: repo.toUpperCase(),
    description: "기존 GitHub 설명", language: null, stars: 0, topics: "[]",
    url: `https://github.com/${repo}`, lastSynced: "", createdAt: "",
    changeKind: null, starsDelta: 0, changedAt: null, source: "sync", isFavorite: 0,
    detailJson: null, readmeMd: "원래 README", readmeMdKo: null, detailFetchedAt: null,
  };
  const displayed = rowToGithubStar(row);
  assert.equal(displayed.description, guide.summary);
  assert.equal(displayed.readmeMd, row.readmeMd);
  assert.equal(rowToGithubStar({ ...row, repoFullName: "zzzz/zzzz" }).description, row.description);
});
