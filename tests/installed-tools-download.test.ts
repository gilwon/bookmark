// 설치 현황 ZIP 다운로드 키 허용 판정을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedZipKey } from "../src/lib/installed-tools-download";

test("스냅샷 zipKey 집합에 정확히 있는 키만 허용하고 경로 조작은 거부한다", () => {
  const allowed = new Set(["claude/mine.zip", "codex/a b.zip"]);
  assert.equal(isAllowedZipKey("claude/mine.zip", allowed), true);
  assert.equal(isAllowedZipKey("codex/a b.zip", allowed), true);
  assert.equal(isAllowedZipKey("claude/other.zip", allowed), false);
  assert.equal(isAllowedZipKey("claude/MINE.zip", allowed), false);
  assert.equal(isAllowedZipKey("", allowed), false);
  assert.equal(isAllowedZipKey(null, allowed), false);
  // 허용 집합에 들어 있어도 .. ·선행 / 는 막는다
  const bad = new Set(["../x.zip", "/claude/mine.zip", "claude\\..\\x.zip"]);
  for (const k of bad) assert.equal(isAllowedZipKey(k, bad), false, k);
});
