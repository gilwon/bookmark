// 설치 현황 스캐너의 순수 파서(프론트매터·shared 판정·Codex 플러그인·경로 가드)를 검증한다
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertNoHomePaths,
  countSlashPrompts,
  countUsage,
  listSkills,
  missingTranslations,
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

test("한글 없는 설명 중 번역 키가 없는 것만 누락으로 센다", () => {
  const snapshot = {
    tools: [
      {
        id: "claude",
        skills: [
          { name: "en", description: "English only" },
          { name: "done", description: "Translated" },
          { name: "ko", description: "한글 설명" },
          { name: "empty", description: "" },
          // 이름이 같고 출처만 다른 쌍은 출처 한정 키로 각각 본다
          { name: "dup", description: "Shared one", source: "shared" },
          { name: "dup", description: "Bundled one", source: "bundled" },
        ],
        plugins: [{ name: "p", description: "Plugin text", marketplace: "m" }],
      },
    ],
  };
  const ko = { "claude/skill/done": "번역됨", "claude/skill/dup/shared": "공유 번역" };
  assert.deepEqual(missingTranslations(snapshot, ko), [
    "claude/skill/en",
    "claude/skill/dup",
    "claude/plugin/p",
  ]);
});

test("스냅샷에 홈 경로가 있으면 에러를 던진다", () => {
  assert.throws(() => assertNoHomePaths('{"p":"/Users/someone/x"}', "/home/x"));
  assert.throws(() => assertNoHomePaths('{"p":"/home/x/y"}', "/home/x"));
  assert.doesNotThrow(() => assertNoHomePaths('{"p":"skills"}', "/home/x"));
});

test("Claude 로그에서 Skill 호출·슬래시 명령·mcp 플러그인 도구를 중복 없이 센다", async () => {
  const installed = { skills: ["sdlc", "eli5", "vibe-check"], plugins: ["eli5", "claude-md-management", "playwright"] };
  const skill = (id, name) =>
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Skill", input: { skill: name } }] } });
  const tool = (id, name) =>
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input: {} }] } });
  const slash = (uuid, name) =>
    JSON.stringify({ type: "user", uuid, message: { content: `<command-message>x</command-message>\n<command-name>/${name}</command-name>` } });
  const lines = [
    skill("t1", "sdlc"),
    skill("t1", "sdlc"), // 같은 tool_use id 중복 기록
    skill("t2", "sdlc"),
    skill("t3", "eli5:eli5"), // 플러그인 접두는 스킬 목록에 같은 이름이 있어도 플러그인에만
    skill("t4", "anthropic-skills:sdlc"), // 미설치 플러그인 접두는 버린다
    skill("t5", "없는-스킬"),
    tool("t6", "mcp__plugin_playwright_playwright__browser_click"),
    tool("t7", "mcp__plugin_claude_md_management_x__y"), // 하이픈이 언더스코어로 바뀐 이름
    slash("u1", "vibe-check"),
    slash("u1", "vibe-check"), // 같은 uuid 중복 기록
    slash("u2", "claude-md-management:revise-claude-md"),
    // tool_result 안의 command-name 은 도구 출력이라 무시한다
    JSON.stringify({ type: "user", uuid: "u3", message: { content: [{ type: "tool_result", content: "<command-name>/sdlc</command-name>" }] } }),
    // 프롬프트 본문 중간에 나온 command-name 도 무시한다
    JSON.stringify({ type: "user", uuid: "u4", message: { content: "설명 <command-name>/sdlc</command-name>" } }),
    '{"type":"assistant","message":{"content":[{"name":"Skill"', // 깨진 줄
  ];
  assert.deepEqual(await countUsage(lines, installed), {
    skills: { sdlc: 2, "vibe-check": 1 },
    plugins: { eli5: 1, playwright: 1, "claude-md-management": 2 },
  });
});

test("Grok 프롬프트 기록에서 설치된 이름의 슬래시 명령만 센다", async () => {
  const installed = { skills: ["sdlc"], plugins: ["eli5"] };
  const p = (prompt) => JSON.stringify({ prompt });
  const lines = [p("/sdlc spec"), p("/sdlc"), p("/Users/x/a.png 봐줘"), p("/eli5:eli5 토픽"), p("그냥 /sdlc"), "깨짐"];
  assert.deepEqual(await countSlashPrompts(lines, installed), {
    skills: { sdlc: 2 },
    plugins: { eli5: 1 },
  });
});
