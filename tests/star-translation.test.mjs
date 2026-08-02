// GitHub Star 설명의 한국어 병기와 번역 API 응답 처리를 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasKorean,
  splitStarDescription,
  translateToKorean,
  withKoreanTranslation,
} from "../src/lib/star-translation.ts";

describe("Star 설명 번역", () => {
  it("기존 병기 설명에서 한국어 문단을 분리한다", () => {
    assert.deepEqual(
      splitStarDescription("English description\n\n한국어 설명"),
      { original: "English description", korean: "한국어 설명" }
    );
    assert.equal(splitStarDescription("English\n\nStill English").korean, null);
  });

  it("설명에 한글이 있으면 API 없이 그대로 사용한다", async () => {
    assert.equal(hasKorean("이미 한국어 설명"), true);
    assert.equal(
      await withKoreanTranslation("이미 한국어 설명", null),
      "이미 한국어 설명"
    );
  });

  it("같은 영문 설명이면 저장된 번역을 재사용한다", async () => {
    assert.equal(
      await withKoreanTranslation(
        "English description",
        "English description\n\n저장된 번역"
      ),
      "English description\n\n저장된 번역"
    );
  });

  it("Responses API의 output_text를 번역 결과로 사용한다", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const previousFetch = globalThis.fetch;
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      return new Response(JSON.stringify({ output_text: "한국어 번역" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      assert.equal(
        await translateToKorean("English description"),
        "한국어 번역"
      );
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
