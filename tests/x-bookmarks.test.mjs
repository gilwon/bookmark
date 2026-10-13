// X 북마크 순수 함수
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import translations from "../src/data/x-bookmark-text-ko.json" with { type: "json" };
import {
  koreanTweetText,
  mergeKoreanTweet,
  presentTweet,
} from "../src/lib/x-bookmark-ko.ts";
import {
  buildStatusUrl,
  isMissingXBookmarksTable,
  mapBookmarkPage,
  nextBookmarkToken,
  parseXTokenPayload,
  serializeXTokenPayload,
  shouldRefreshAccessToken,
} from "../src/lib/x-bookmarks.ts";

describe("buildStatusUrl", () => {
  it("사용자 이름이 있으면 그 주소다", () => {
    assert.equal(
      buildStatusUrl("alice", "123"),
      "https://x.com/alice/status/123"
    );
  });

  it("이름이 없으면 i/status다", () => {
    assert.equal(buildStatusUrl("  ", "99"), "https://x.com/i/status/99");
  });
});

describe("mapBookmarkPage", () => {
  it("작성자를 붙이고 빈 본문과 빠진 id를 처리한다", () => {
    const rows = mapBookmarkPage({
      data: [
        {
          id: "1",
          text: "hello",
          author_id: "u1",
          created_at: "2026-10-01T00:00:00.000Z",
        },
        { id: "2", author_id: "missing" },
        { text: "no id" },
        { id: "1", text: "later", author_id: "u1" },
      ],
      includes: { users: [{ id: "u1", name: "앨리스", username: "alice" }] },
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].text, "later");
    assert.equal(rows[0].authorName, "앨리스");
    assert.equal(rows[0].url, "https://x.com/alice/status/1");
    assert.equal(rows[1].text, "");
    assert.equal(rows[1].url, "https://x.com/i/status/2");
  });
});

describe("nextBookmarkToken", () => {
  it("다음 토큰이 있으면 문자열이다", () => {
    assert.equal(nextBookmarkToken({ meta: { next_token: "abc" } }), "abc");
    assert.equal(nextBookmarkToken({ meta: {} }), null);
    assert.equal(nextBookmarkToken({ meta: { next_token: "  " } }), null);
  });
});

describe("shouldRefreshAccessToken", () => {
  const now = Date.parse("2026-10-07T00:00:00.000Z");

  it("만료 60초 전이면 갱신한다", () => {
    assert.equal(
      shouldRefreshAccessToken("2026-10-07T00:00:30.000Z", now),
      true
    );
    assert.equal(
      shouldRefreshAccessToken("2026-10-07T00:02:00.000Z", now),
      false
    );
    assert.equal(shouldRefreshAccessToken("not-a-date", now), true);
  });
});

describe("parseXTokenPayload", () => {
  it("왕복되고 깨진 JSON은 null이다", () => {
    const payload = {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: "2026-10-07T02:00:00.000Z",
      xUserId: "7",
    };
    assert.deepEqual(parseXTokenPayload(serializeXTokenPayload(payload)), payload);
    assert.equal(parseXTokenPayload("{"), null);
    assert.equal(parseXTokenPayload(JSON.stringify({ accessToken: "a" })), null);
  });
});

describe("한국어 번역", () => {
  const tweetId = "2109451106611036457";

  it("한글이 없는 본문에만 표의 번역을 붙인다", () => {
    assert.equal(Object.keys(translations).length, 52);
    for (const value of Object.values(translations)) {
      assert.match(value, /[가-힣]/);
    }
    const ko = translations[tweetId];
    assert.equal(
      koreanTweetText(tweetId, "Diagram Design hit 50k stars"),
      ko
    );
    assert.equal(koreanTweetText(tweetId, "이미 한글입니다"), "");
    assert.equal(koreanTweetText("없는-게시", "English only"), "");
  });

  it("저장과 화면 분리가 한 번만 일어난다", () => {
    const api = "was out all day";
    const stored = mergeKoreanTweet(tweetId, api);
    assert.equal(stored, `${api}\n\n${translations[tweetId]}`);
    assert.equal(mergeKoreanTweet(tweetId, stored), stored);
    assert.deepEqual(presentTweet(tweetId, stored), {
      text: api,
      textKo: translations[tweetId],
    });
    assert.deepEqual(presentTweet(tweetId, api), {
      text: api,
      textKo: translations[tweetId],
    });
    assert.deepEqual(presentTweet(tweetId, "이미 한글입니다"), {
      text: "이미 한글입니다",
      textKo: "",
    });
  });
});

describe("isMissingXBookmarksTable", () => {
  it("테이블 부재 문구만 참이다", () => {
    assert.equal(
      isMissingXBookmarksTable(
        "Could not find the table 'public.x_bookmarks' in the schema cache"
      ),
      true
    );
    assert.equal(isMissingXBookmarksTable("bookmarks does not exist"), false);
  });
});
