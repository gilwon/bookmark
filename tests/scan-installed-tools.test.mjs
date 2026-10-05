// 설치 현황 스캐너의 순수 파서(프론트매터·shared 판정·Codex 플러그인·경로 가드)를 검증한다
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertNoHomePaths,
  listSkills,
  parseCodexPlugins,
  parseDescription,
} from "../scripts/scan-installed-tools.mjs";

test("프론트매터 description 을 한 줄·여러 줄로 읽고 실패하면 빈 문자열", () => {
  assert.equal(parseDescription("---\nname: a\ndescription: 한 줄 설명\n---\n본문"), "한 줄 설명");
  assert.equal(parseDescription('---\ndescription: "따옴표 설명"\n---'), "따옴표 설명");
  assert.equal(
    parseDescription("---\ndescription: >\n  첫 줄\n  둘째 줄\nname: b\n---"),
    "첫 줄 둘째 줄"
  );
  assert.equal(parseDescription("---\ndescription: |-\n  가\n  나\n---"), "가 나");
  assert.equal(parseDescription("프론트매터 없음"), "");
  assert.equal(parseDescription("---\nname: c\n---"), "");
});

test("스킬 폴더에서 SKILL.md 없는 항목과 점 항목을 빼고 공유 링크를 shared 로 본다", async () => {
  const root = await mkdtemp(join(tmpdir(), "scan-tools-"));
  try {
    const skills = join(root, "skills");
    const shared = join(root, ".agents/skills/c");
    await mkdir(join(skills, "a"), { recursive: true });
    await mkdir(join(skills, "b"), { recursive: true });
    await mkdir(join(skills, "d"), { recursive: true });
    await mkdir(join(skills, ".backups"), { recursive: true });
    await mkdir(shared, { recursive: true });
    await writeFile(join(skills, "a/SKILL.md"), "---\ndescription: 에이\n---\n");
    await writeFile(join(skills, "b/SKILL.md"), "---\ndescription: >\n  비\n  설명\n---\n");
    await writeFile(join(skills, ".backups/SKILL.md"), "---\ndescription: 숨김\n---\n");
    await writeFile(join(shared, "SKILL.md"), "---\ndescription: 공유\n---\n");
    await symlink(shared, join(skills, "c"));

    assert.deepEqual(await listSkills(skills, "user"), [
      { name: "a", description: "에이", source: "user" },
      { name: "b", description: "비 설명", source: "user" },
      { name: "c", description: "공유", source: "shared" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Codex config.toml 에서 enabled = true 플러그인만 뽑는다", () => {
  const toml = [
    '[plugins."on@market"]',
    "enabled = true",
    "",
    '[plugins."off@market"]',
    "enabled = false",
    "",
    '[plugins."late@other"]',
    'note = "x"',
    "enabled = true",
    "",
    "[other]",
    "enabled = true",
  ].join("\n");
  assert.deepEqual(parseCodexPlugins(toml), [
    { name: "on", marketplace: "market" },
    { name: "late", marketplace: "other" },
  ]);
});

test("스냅샷에 홈 경로가 있으면 에러를 던진다", () => {
  assert.throws(() => assertNoHomePaths('{"p":"/Users/someone/x"}', "/home/x"));
  assert.throws(() => assertNoHomePaths('{"p":"/home/x/y"}', "/home/x"));
  assert.doesNotThrow(() => assertNoHomePaths('{"p":"skills"}', "/home/x"));
});
