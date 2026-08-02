// GitHub Star 설명의 정적 한국어 병기 처리를 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasKorean,
  splitStarDescription,
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

  it("설명에 한글이 있으면 그대로 사용한다", () => {
    assert.equal(hasKorean("이미 한국어 설명"), true);
    assert.equal(
      withKoreanTranslation("unknown/repo", "이미 한국어 설명", null),
      "이미 한국어 설명"
    );
  });

  it("같은 영문 설명이면 저장된 번역을 재사용한다", () => {
    assert.equal(
      withKoreanTranslation(
        "unknown/repo",
        "English description",
        "English description\n\n저장된 번역"
      ),
      "English description\n\n저장된 번역"
    );
  });

  it("정적 번역 매핑이 있으면 한국어를 병기한다", () => {
    assert.equal(
      withKoreanTranslation(
        "addyosmani/agent-skills",
        "Production-grade engineering skills for AI coding agents.",
        null
      ),
      "Production-grade engineering skills for AI coding agents.\n\nAI 코딩 에이전트를 위한 프로덕션급 엔지니어링 스킬 모음."
    );
  });
});
