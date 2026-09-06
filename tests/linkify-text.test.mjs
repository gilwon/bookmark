// 본문 URL 링크화 조각 나누기
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitLinkifyParts } from "../src/lib/linkify-text.ts";

describe("splitLinkifyParts", () => {
  it("빈 문자열은 빈 배열이다", () => {
    assert.deepEqual(splitLinkifyParts(""), []);
  });

  it("링크가 없으면 통째로 text 한 조각이다", () => {
    assert.deepEqual(splitLinkifyParts("그냥 텍스트"), [
      { type: "text", value: "그냥 텍스트" },
    ]);
  });

  it("https URL 단독을 링크로 나눈다", () => {
    assert.deepEqual(splitLinkifyParts("https://example.com/a"), [
      {
        type: "link",
        href: "https://example.com/a",
        value: "https://example.com/a",
      },
    ]);
  });

  it("앞뒤 한글 문장 사이 URL을 나눈다", () => {
    assert.deepEqual(splitLinkifyParts("참고는 https://example.com/a 이다"), [
      { type: "text", value: "참고는 " },
      {
        type: "link",
        href: "https://example.com/a",
        value: "https://example.com/a",
      },
      { type: "text", value: " 이다" },
    ]);
  });

  it("끝 마침표는 링크에서 뺀다", () => {
    assert.deepEqual(splitLinkifyParts("https://example.com."), [
      {
        type: "link",
        href: "https://example.com",
        value: "https://example.com",
      },
      { type: "text", value: "." },
    ]);
  });

  it("괄호가 짝이면 경로의 닫는 괄호를 유지한다", () => {
    const url = "https://en.wikipedia.org/wiki/Foo_(bar)";
    assert.deepEqual(splitLinkifyParts(url), [
      { type: "link", href: url, value: url },
    ]);
  });

  it("짝이 없는 닫는 괄호와 마침표는 링크 밖으로 보낸다", () => {
    assert.deepEqual(splitLinkifyParts("https://ex.com)."), [
      { type: "link", href: "https://ex.com", value: "https://ex.com" },
      { type: "text", value: ")." },
    ]);
  });

  it("www. 로 시작하면 https:// 를 붙인다", () => {
    assert.deepEqual(splitLinkifyParts("www.example.com"), [
      {
        type: "link",
        href: "https://www.example.com",
        value: "www.example.com",
      },
    ]);
  });

  it("마크다운 링크는 라벨을 보여 주고 href는 URL이다", () => {
    assert.deepEqual(splitLinkifyParts("[문서](https://example.com/x)"), [
      { type: "link", href: "https://example.com/x", value: "문서" },
    ]);
  });

  it("javascript: 와 마크다운 javascript: 는 링크가 아니다", () => {
    assert.deepEqual(splitLinkifyParts("javascript:alert(1)"), [
      { type: "text", value: "javascript:alert(1)" },
    ]);
    assert.deepEqual(splitLinkifyParts("[x](javascript:alert(1))"), [
      { type: "text", value: "[x](javascript:alert(1))" },
    ]);
  });

  it("여러 URL과 줄바꿈을 보존한다", () => {
    assert.deepEqual(
      splitLinkifyParts("하나 https://a.example/x\n둘 http://b.example/y"),
      [
        { type: "text", value: "하나 " },
        {
          type: "link",
          href: "https://a.example/x",
          value: "https://a.example/x",
        },
        { type: "text", value: "\n둘 " },
        {
          type: "link",
          href: "http://b.example/y",
          value: "http://b.example/y",
        },
      ]
    );
  });

  it("http 로컬 주소도 허용한다", () => {
    assert.deepEqual(splitLinkifyParts("http://127.0.0.1:3000/path"), [
      {
        type: "link",
        href: "http://127.0.0.1:3000/path",
        value: "http://127.0.0.1:3000/path",
      },
    ]);
  });
});
