// README 한국어 판별·코드 펜스 보호·번역 호출을 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  README_KO_MAX_CHARS,
  extractFencedCode,
  isMostlyKorean,
  restoreFencedCode,
} from "../src/lib/star-readme-ko.ts";
import { translateReadmeToKorean } from "../src/lib/star-readme-translate.ts";

describe("isMostlyKorean", () => {
  it("null·빈 값은 false이다", () => {
    assert.equal(isMostlyKorean(null), false);
    assert.equal(isMostlyKorean(undefined), false);
    assert.equal(isMostlyKorean(""), false);
  });

  it("영문 README는 false이다", () => {
    assert.equal(
      isMostlyKorean(
        "# Install\n\nRun `npm install` and follow the usage guide below."
      ),
      false
    );
  });

  it("한국어 README는 true이다", () => {
    assert.equal(
      isMostlyKorean(
        "# 소개\n\n이 프로젝트는 북마크를 모으고 검색합니다. 설치와 사용법은 아래를 참고하세요."
      ),
      true
    );
  });

  it("긴 영문에 한글 단어 하나면 false이다", () => {
    const mixed = `${"This is an English README about installation and usage. ".repeat(8)}한글`;
    assert.equal(isMostlyKorean(mixed), false);
  });
});

describe("extractFencedCode / restoreFencedCode", () => {
  it("펜스 코드를 자리표시로 뺐다가 되돌린다", () => {
    const md =
      "# Title\n\n```ts\nconst x = 1;\nconsole.log('$&');\n```\n\nSee [docs](https://example.com).\n";
    const { text, fences } = extractFencedCode(md);
    assert.equal(text.includes("⟦CODE_0⟧"), true);
    assert.equal(text.includes("const x = 1"), false);
    assert.equal(fences.length, 1);
    assert.equal(fences[0].includes("```ts"), true);
    assert.equal(restoreFencedCode(text, fences), md);
  });
});

describe("translateReadmeToKorean", () => {
  it("XAI_API_KEY가 없으면 null이다", async () => {
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      const result = await translateReadmeToKorean("# Hello world\n\nInstall it.");
      assert.equal(result, null);
    } finally {
      if (prev === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = prev;
    }
  });

  it("영문 README의 펜스를 복원하고 한글을 돌려준다", async () => {
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "test-key";
    const orig = globalThis.fetch;
    const md = "# Hello\n\n```js\nconsole.log(1)\n```\n\nInstall it.";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://api.x.ai/v1/chat/completions");
      const body = JSON.parse(String(init?.body ?? "{}"));
      assert.equal(body.model, "grok-4.6");
      const user = body.messages[1].content;
      assert.equal(user.includes("⟦CODE_0⟧"), true);
      assert.equal(user.includes("console.log"), false);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "# 안녕\n\n⟦CODE_0⟧\n\n설치하세요.",
              },
            },
          ],
        }),
        { status: 200 }
      );
    };
    try {
      const result = await translateReadmeToKorean(md);
      assert.equal(result?.includes("안녕"), true);
      assert.equal(result?.includes("```js\nconsole.log(1)\n```"), true);
      assert.equal(result?.includes("⟦CODE_0⟧"), false);
    } finally {
      globalThis.fetch = orig;
      if (prev === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = prev;
    }
  });
});

describe("README_KO_MAX_CHARS", () => {
  it("번역 입력 상한은 2만 자다", () => {
    assert.equal(README_KO_MAX_CHARS, 20_000);
  });
});
