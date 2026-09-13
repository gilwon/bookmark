// 그록봇 URL 정규화·엔트리 파싱·테이블 부재 판정
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  grokBotHaystack,
  isMissingGrokBotsTable,
  normalizeTemplateUrl,
  parseGrokBotEntries,
  rowToGrokBot,
  stringifyGrokBotEntries,
} from "../src/lib/grok-bot.ts";

describe("normalizeTemplateUrl", () => {
  it("앞뒤 공백과 끝 슬래시를 제거한다", () => {
    assert.equal(
      normalizeTemplateUrl("  https://x.ai/bot/foo/  "),
      "https://x.ai/bot/foo"
    );
    assert.equal(
      normalizeTemplateUrl("https://x.ai/bot/foo///"),
      "https://x.ai/bot/foo"
    );
  });

  it("빈 값은 빈 문자열이다", () => {
    assert.equal(normalizeTemplateUrl(""), "");
    assert.equal(normalizeTemplateUrl("   "), "");
    assert.equal(normalizeTemplateUrl(null), "");
    assert.equal(normalizeTemplateUrl(undefined), "");
  });
});

describe("parseGrokBotEntries", () => {
  it("JSON 문자열 객체를 파싱한다", () => {
    assert.deepEqual(
      parseGrokBotEntries(
        JSON.stringify([
          { name: "A", description_ko: "설명" },
          { name: "B", descriptionKo: "한글", schedule: "매일" },
        ])
      ),
      [
        { name: "A", descriptionKo: "설명" },
        { name: "B", descriptionKo: "한글", schedule: "매일" },
      ]
    );
  });

  it("문자열 배열의 Name: desc와 Name | desc를 나눈다", () => {
    assert.deepEqual(parseGrokBotEntries(["Alpha: 첫 설명", "Beta | 둘째"]), [
      { name: "Alpha", descriptionKo: "첫 설명" },
      { name: "Beta", descriptionKo: "둘째" },
    ]);
  });

  it("빈 이름은 건너뛴다", () => {
    assert.deepEqual(
      parseGrokBotEntries([{ name: "  " }, { name: "OK" }, ""]),
      [{ name: "OK" }]
    );
  });

  it("객체 배열을 그대로 받는다", () => {
    assert.deepEqual(
      parseGrokBotEntries([{ name: "Run", descriptionKo: "실행" }]),
      [{ name: "Run", descriptionKo: "실행" }]
    );
  });
});

describe("stringifyGrokBotEntries", () => {
  it("왕복 후에도 이름과 설명을 유지한다", () => {
    const entries = [
      { name: "A", descriptionKo: "설명" },
      { name: "B", schedule: "주간" },
    ];
    assert.deepEqual(
      parseGrokBotEntries(stringifyGrokBotEntries(entries)),
      entries
    );
  });
});

describe("isMissingGrokBotsTable", () => {
  it("스키마 캐시 부재 메시지를 알아본다", () => {
    assert.equal(
      isMissingGrokBotsTable(
        "Could not find the table 'public.grok_bots' in the schema cache"
      ),
      true
    );
    assert.equal(isMissingGrokBotsTable("thread_copies missing"), false);
  });
});

describe("rowToGrokBot", () => {
  it("0/1 플래그와 JSON 엔트리를 앱 타입으로 바꾼다", () => {
    const bot = rowToGrokBot({
      id: "1",
      userId: "u",
      slug: "foo",
      name: "봇",
      nameEn: "Bot",
      creator: "A",
      category: "리서치",
      description: "설명",
      howItWorks: "방식",
      notes: "",
      skills: JSON.stringify([{ name: "S1" }]),
      routines: "[]",
      templateUrl: "https://x.ai/bot/foo",
      sourceUrl: "",
      officialMarketplace: 1,
      isFavorite: 0,
      createdAt: "t",
      updatedAt: "t",
    });
    assert.equal(bot.officialMarketplace, true);
    assert.equal(bot.isFavorite, false);
    assert.equal(bot.sourceUrl, null);
    assert.deepEqual(bot.skills, [{ name: "S1" }]);
    assert.ok(grokBotHaystack(bot).includes("리서치"));
  });
});
