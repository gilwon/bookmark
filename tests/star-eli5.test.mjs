// Star 다섯 살 설명 HTML의 문장·장면·이스케이프를 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStarEli5Html,
  eli5Lines,
  pickEli5Scene,
} from "../src/lib/star-eli5.ts";

describe("eli5Lines", () => {
  it("한글 문단만 최대 두 문장으로 고른다", () => {
    assert.deepEqual(
      eli5Lines("English about stays.\n\n첫번째 문장입니다. 두번째 문장입니다. 세번째 문장입니다."),
      ["첫번째 문장입니다.", "두번째 문장입니다."]
    );
  });

  it("한글이 없으면 영어 문장을 쓴다", () => {
    assert.deepEqual(eli5Lines("Fast agent. Cheap too."), [
      "Fast agent.",
      "Cheap too.",
    ]);
  });

  it("빈 설명은 문장이 없다", () => {
    assert.deepEqual(eli5Lines("  \n"), []);
    assert.deepEqual(eli5Lines(null), []);
  });

  it("120자를 넘는 문장은 말줄임으로 줄인다", () => {
    const long = `${"가".repeat(150)}입니다.`;
    const [line] = eli5Lines(long);
    assert.equal(line.endsWith("…"), true);
    assert.equal(line.length < long.length, true);
    assert.equal(line.length <= 121, true);
  });
});

describe("pickEli5Scene", () => {
  it("영상·AI·그 밖을 구분한다", () => {
    assert.equal(pickEli5Scene("영상 편집기"), "video");
    assert.equal(pickEli5Scene("AI agent workspace"), "ai");
    assert.equal(pickEli5Scene("알 수 없는 도구"), "star");
  });

  it("email의 ai 글자로는 AI 장면을 고르지 않는다", () => {
    assert.equal(pickEli5Scene("email client"), "star");
  });
});

describe("buildStarEli5Html", () => {
  it("빈 설명은 아직 없다는 말과 그림만 보여 준다", () => {
    const html = buildStarEli5Html({
      repoFullName: "owner/repo",
      description: "   ",
    });
    assert.match(html, /이 별은 아직 짧은 설명이 없어요\./);
    assert.equal(html.includes("<script"), false);
    assert.match(html, /<!DOCTYPE html>/);
    assert.match(html, /<svg/);
    assert.match(html, /data-scene="star"/);
  });

  it("설명과 이름의 태그를 이스케이프하고 스크립트 주소를 빼다", () => {
    const html = buildStarEli5Html({
      repoFullName: "a<b",
      description: "<script>alert(1)</script>",
      url: "javascript:alert(1)",
    });
    assert.equal(html.includes("<script"), false);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /a&lt;b/);
    assert.equal(html.includes("javascript:"), false);
  });

  it("자세한 경로는 /stars/만 링크로 둔다", () => {
    const ok = buildStarEli5Html({
      repoFullName: "o/r",
      description: "설명입니다.",
      detailPath: "/stars/abc",
    });
    assert.match(ok, /href="\/stars\/abc"/);
    assert.match(ok, /target="_top"/);
    assert.match(ok, /자세히 보기/);

    const bad = buildStarEli5Html({
      repoFullName: "o/r",
      description: "설명입니다.",
      detailPath: "https://evil.example",
    });
    assert.equal(bad.includes("evil.example"), false);
  });

  it("영상 설명은 video 장면을 쓴다", () => {
    const html = buildStarEli5Html({
      repoFullName: "someone/clips",
      description: "영상 편집기입니다.",
    });
    assert.match(html, /data-scene="video"/);
    assert.match(html, /영상 편집기입니다\./);
  });
});
