// 설치 현황 동기화의 요약 파싱·배포 환경 판정·출력 상한, 데이터 원본 선택과 시각 표기를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatKst,
  pickLatestSnapshot,
  zipKeysOf,
  type InstalledToolsSnapshot,
} from "../src/lib/installed-tools";
import { SNAPSHOT_KEY } from "../scripts/scan-installed-tools.mjs";
import {
  INSTALLED_TOOLS_SNAPSHOT_KEY,
  appendTail,
  isDeploymentEnv,
  parseSyncSummary,
} from "../src/lib/installed-tools-sync";

test("출력 꼬리의 마지막 SYNC_SUMMARY 줄을 파싱하고 없거나 깨지면 null", () => {
  const out =
    "Claude: 스킬 3개\nSYNC_SUMMARY skills=1 plugins=1 zip=1 generatedAt=2026-01-01T00:00:00.000Z\n" +
    "SYNC_SUMMARY skills=3 plugins=1 zip=4 generatedAt=2026-10-05T01:02:03.000Z\n";
  assert.deepEqual(parseSyncSummary(out), {
    skills: 3,
    plugins: 1,
    zip: 4,
    syncedAt: "2026-10-05T01:02:03.000Z",
  });
  assert.equal(parseSyncSummary("아무 출력"), null);
  assert.equal(parseSyncSummary("SYNC_SUMMARY skills=x plugins=1 zip=0 generatedAt=2026-10-05T00:00:00Z"), null);
  assert.equal(parseSyncSummary("SYNC_SUMMARY skills=1 plugins=1 zip=0 generatedAt=nope"), null);
  // 줄 중간에 끼어든 문자열은 요약으로 보지 않는다
  assert.equal(parseSyncSummary("x SYNC_SUMMARY skills=1 plugins=1 zip=0 generatedAt=2026-10-05T00:00:00Z"), null);
});

test("VERCEL 이 있거나 ~/.claude 가 없으면 배포 환경", () => {
  assert.equal(isDeploymentEnv({ vercel: "1", hasClaudeDir: true }), true);
  assert.equal(isDeploymentEnv({ vercel: undefined, hasClaudeDir: false }), true);
  assert.equal(isDeploymentEnv({ vercel: "", hasClaudeDir: true }), false);
  assert.equal(isDeploymentEnv({ vercel: undefined, hasClaudeDir: true }), false);
});

test("출력 상한을 넘으면 앞을 버리고 꼬리를 남긴다", () => {
  assert.equal(appendTail("abc", "def", 4), "cdef");
  assert.equal(appendTail("ab", "c", 4), "abc");
});

const snap = (generatedAt: string, zipKey?: string): InstalledToolsSnapshot => ({
  generatedAt,
  tools: [{ id: "claude", label: "Claude", skills: [{ name: "a", description: "", source: "user", uses: 0, zipKey }], plugins: [] }],
});

test("원본 선택은 generatedAt 이 더 나중인 쪽, 원격이 없거나 깨지면 정적", () => {
  const local = snap("2026-10-01T00:00:00.000Z", "claude/old.zip");
  const newer = snap("2026-10-05T00:00:00.000Z", "claude/new.zip");
  const older = snap("2026-09-01T00:00:00.000Z");
  assert.equal(pickLatestSnapshot(newer, local), newer);
  assert.equal(pickLatestSnapshot(older, local), local);
  assert.equal(pickLatestSnapshot(null, local), local);
  assert.equal(pickLatestSnapshot({ generatedAt: "nope", tools: [] }, local), local);
  assert.equal(pickLatestSnapshot({ generatedAt: "2026-12-01T00:00:00Z" }, local), local);
  // 같은 시각이면 원격(Storage)을 쓴다
  const same = snap(local.generatedAt);
  assert.equal(pickLatestSnapshot(same, local), same);
  // 허용 키도 고른 원본에서 나온다
  assert.deepEqual([...zipKeysOf(pickLatestSnapshot(newer, local))], ["claude/new.zip"]);
});

test("마지막 동기화 시각을 한국 시간 YYYY-MM-DD HH:mm 로 보인다", () => {
  assert.equal(formatKst("2026-10-04T15:30:00.000Z"), "2026-10-05 00:30");
  assert.equal(formatKst("nope"), "");
});

test("스크립트가 올리는 키와 로더가 읽는 키가 같다", () => {
  assert.equal(INSTALLED_TOOLS_SNAPSHOT_KEY, SNAPSHOT_KEY);
});
