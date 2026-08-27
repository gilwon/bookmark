// 링크 4건 Pages 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  FIELDBY_HEX,
  TARGETS,
  fillFaqAnswers,
  hasNoExpiredUrl,
  stripTracking,
} from "../scripts/import-four-pages-20260828.mjs";

test("대상은 4건이고 fieldby hex는 skip 목록에 있다", () => {
  assert.equal(TARGETS.length, 4);
  const fieldby = TARGETS.find((item) => item.key === "fieldby");
  assert.equal(Boolean(fieldby), true);
  assert.equal(fieldby.skip, true);
  assert.equal(fieldby.hex, FIELDBY_HEX);
  assert.equal(FIELDBY_HEX, "3c5d730b39538128a0b3cd708a04e204");
  assert.equal(
    TARGETS.some((item) => item.skip && item.hex === FIELDBY_HEX),
    true
  );
});

test("stripTracking은 fbclid·utm·mcp_token을 뺀다", () => {
  const cleaned = stripTracking(
    "https://qjc.app/blog/chatgpt-scheduled-tasks-free?utm_source=fb&utm_medium=cpc&fbclid=IwAR123&mcp_token=abc"
  );
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("utm_medium"), false);
  assert.equal(cleaned.includes("mcp_token"), false);
  assert.equal(cleaned, "https://qjc.app/blog/chatgpt-scheduled-tasks-free");
});

test("fillFaqAnswers는 빈 헤딩 뒤에 답을 넣는다", () => {
  const filled = fillFaqAnswers(`## 잘 안 될 때 확인할 것

### claude: command not found가 나옵니다

### 마켓플레이스가 이미 있다고 나옵니다

`);
  assert.equal(
    filled.includes(
      "Claude Code가 설치되어 있는지 확인하고 터미널을 다시 여세요"
    ),
    true
  );
  assert.equal(
    filled.includes("마켓플레이스 추가 명령어는 건너뛰고"),
    true
  );
  assert.match(
    filled,
    /### claude: command not found가 나옵니다\n\nClaude Code가 설치되어 있는지/
  );
});

test("만료 URL 문자열이 본문에 없으면 true다", () => {
  assert.equal(hasNoExpiredUrl("# 제목\n\n본문입니다."), true);
  assert.equal(
    hasNoExpiredUrl("https://prod-files-secure.s3.us-west-2.amazonaws.com/x"),
    false
  );
  assert.equal(hasNoExpiredUrl("https://file.notion.so/f"), false);
  assert.equal(hasNoExpiredUrl("https://example.com/?X-Amz-Signature=1"), false);
});
