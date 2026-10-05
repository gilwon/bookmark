// 설치 현황 스캐너의 순수 파서(프론트매터·shared 판정·Codex 플러그인·경로 가드)를 검증한다
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertNoHomePaths,
  claudePluginSource,
  codexPluginSource,
  countSlashPrompts,
  countUsage,
  githubRepoUrl,
  grokPluginSource,
  inheritZipKeys,
  isExcludedFile,
  listSkills,
  lockSkillSource,
  missingTranslations,
  parseCodexMarketplaces,
  parseCodexPlugins,
  parseDescription,
  planZipEntries,
  zipObjectName,
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
      { name: "a", description: "에이", source: "user", dir: join(skills, "a") },
      { name: "b", description: "비 설명", source: "user", dir: join(skills, "b") },
      { name: "c", description: "공유", source: "shared", dir: join(skills, "c") },
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

test("GitHub 주소만 통과시키고 .git·끝 / 를 떼며 자격 증명·토큰이 든 주소는 버린다", () => {
  assert.equal(githubRepoUrl("https://github.com/a/b.git"), "https://github.com/a/b");
  assert.equal(githubRepoUrl("https://github.com/a/b/"), "https://github.com/a/b");
  assert.equal(githubRepoUrl({ type: "git", url: "https://github.com/a/b" }), "https://github.com/a/b");
  assert.equal(githubRepoUrl("https://user:pass@github.com/a/b.git"), undefined);
  assert.equal(githubRepoUrl("https://github.com/a/b?token=x"), undefined);
  assert.equal(githubRepoUrl("https://gitlab.com/a/b"), undefined);
  assert.equal(githubRepoUrl("git@github.com:a/b.git"), undefined);
  assert.equal(githubRepoUrl("/Users/me/market"), undefined);
  assert.equal(githubRepoUrl(undefined), undefined);
});

test("Claude 플러그인은 plugin.json 링크를 우선하고 명령은 마켓 저장소 기준 두 줄", () => {
  const market = { source: { source: "github", repo: "org/market" } };
  assert.deepEqual(
    claudePluginSource({ name: "p", marketplace: "m", manifest: { repository: "https://github.com/x/p" }, market }),
    { repoUrl: "https://github.com/x/p", installCommands: ["/plugin marketplace add org/market", "/plugin install p@m"] }
  );
  assert.deepEqual(claudePluginSource({ name: "p", marketplace: "m", manifest: null, market }).repoUrl, "https://github.com/org/market");
  // 마켓이 github 가 아니면 명령이 없다
  assert.deepEqual(
    claudePluginSource({ name: "p", marketplace: "m", manifest: { homepage: "https://github.com/x/p" }, market: { source: { source: "directory" } } }),
    { repoUrl: "https://github.com/x/p" }
  );
  assert.deepEqual(claudePluginSource({ name: "p", marketplace: "m", manifest: null, market: undefined }), {});
});

test("Codex 마켓은 git 소스만 출처로 쓰고 로컬 경로 마켓은 버린다", () => {
  const toml = [
    "[marketplaces.local-one]",
    'source_type = "local"',
    'source = "/Users/me/x"',
    "",
    "[marketplaces.gh]",
    'source_type = "git"',
    'source = "https://github.com/o/r.git"',
    "",
    '[plugins."p@gh"]',
    "enabled = true",
  ].join("\n");
  const markets = parseCodexMarketplaces(toml);
  assert.deepEqual(markets.gh, { sourceType: "git", source: "https://github.com/o/r.git" });
  assert.deepEqual(codexPluginSource({ name: "p", marketplace: "gh" }, markets), {
    repoUrl: "https://github.com/o/r",
    installCommands: ["codex plugin marketplace add o/r", "codex plugin add p@gh"],
  });
  assert.deepEqual(codexPluginSource({ name: "q", marketplace: "local-one" }, markets), {});
});

test("Grok 플러그인은 kind.url 을 링크로, 설치 명령은 owner/repo 한 줄", () => {
  assert.deepEqual(grokPluginSource({ type: "Git", url: "https://github.com/o/r.git" }), {
    repoUrl: "https://github.com/o/r",
    installCommands: ["grok plugin install o/r"],
  });
  assert.deepEqual(grokPluginSource({ type: "Local", path: "/Users/me/p" }), {});
});

test("스킬 락 파일의 같은 이름 항목만 출처로 쓰고 번들은 제외한다", () => {
  const lock = { skills: { a: { source: "o/r", sourceUrl: "https://github.com/o/r.git" }, b: { source: "x y", sourceUrl: "https://github.com/o/b" } } };
  assert.deepEqual(lockSkillSource({ name: "a", source: "shared" }, lock), {
    repoUrl: "https://github.com/o/r",
    installCommands: ["npx skills add o/r --skill a"],
  });
  // source 가 owner/repo 가 아니면 링크에서 만든다
  assert.deepEqual(lockSkillSource({ name: "b", source: "user" }, lock).installCommands, ["npx skills add o/b --skill b"]);
  assert.deepEqual(lockSkillSource({ name: "a", source: "bundled" }, lock), {});
  assert.deepEqual(lockSkillSource({ name: "none", source: "user" }, lock), {});
  assert.deepEqual(lockSkillSource({ name: "a", source: "user" }, null), {});
});

test("ZIP 제외 규칙과 5MB 상한", () => {
  for (const rel of [".git/HEAD", "node_modules/x/i.js", ".DS_Store", ".env.local", "a/server.pem", "id.KEY", "my-Credentials.json", "SECRET.md", "tokens.txt", "keys/id_rsa.pub"]) {
    assert.equal(isExcludedFile(rel, 10), true, rel);
  }
  assert.equal(isExcludedFile("SKILL.md", 10), false);
  assert.equal(isExcludedFile("big.bin", 1024 * 1024 + 1), true);
  assert.equal(isExcludedFile("ok.bin", 1024 * 1024), false);

  const plan = planZipEntries([{ rel: "SKILL.md", size: 100 }, { rel: ".env", size: 5 }, { rel: "big", size: 2 * 1024 * 1024 }]);
  assert.deepEqual(plan, { keep: [{ rel: "SKILL.md", size: 100 }], excludedCount: 2, total: 100, skipped: false });
  const mb1 = 1024 * 1024;
  const heavy = planZipEntries(Array.from({ length: 6 }, (_, i) => ({ rel: `f${i}`, size: mb1 })));
  assert.equal(heavy.skipped, true);
  assert.equal(heavy.total, 6 * mb1);
});

test("이전 스냅샷의 zipKey 는 지금도 ZIP 대상인 스킬에만 이어받는다", () => {
  const prev = { tools: [{ id: "claude", skills: [{ name: "mine", zipKey: "claude/mine.zip" }, { name: "now-linked", zipKey: "claude/now-linked.zip" }, { name: "b", zipKey: "claude/b.zip" }] }] };
  const snap = {
    tools: [
      {
        id: "claude",
        skills: [
          { name: "mine", source: "user" },
          { name: "now-linked", source: "shared", repoUrl: "https://github.com/o/r" },
          { name: "b", source: "bundled" },
          { name: "new", source: "user" },
        ],
      },
    ],
  };
  inheritZipKeys(snap, prev);
  assert.deepEqual(snap.tools[0].skills.map((s) => s.zipKey), ["claude/mine.zip", undefined, undefined, undefined]);
  // 이전 스냅샷이 없어도 깨지지 않는다
  assert.doesNotThrow(() => inheritZipKeys(snap, null));
});

test("zipObjectName: ASCII 이름은 그대로, 한글 이름은 hex 로 바꾼다", () => {
  assert.equal(zipObjectName("design-quality-check"), "design-quality-check");
  assert.match(zipObjectName("수노프롬프트빌더"), /^u-[0-9a-f]+$/);
});

test("parseDescription: 첫 줄 값에 이어 들여쓴 줄도 합친다", () => {
  assert.equal(
    parseDescription("---\ndescription: Use these skills when you need to explore the database\n  schema, execute queries.\nname: x\n---"),
    "Use these skills when you need to explore the database schema, execute queries."
  );
});

test("--sync 요약 줄은 전 도구 스킬·플러그인 합계와 이번 ZIP 수, generatedAt 을 담는다", async () => {
  const { syncSummaryLine } = await import("../scripts/scan-installed-tools.mjs");
  const snap = {
    generatedAt: "2026-10-05T01:02:03.000Z",
    tools: [
      { id: "claude", skills: [{}, {}], plugins: [{}] },
      { id: "codex", skills: [{}], plugins: [] },
    ],
  };
  assert.equal(
    syncSummaryLine(snap, 4),
    "SYNC_SUMMARY skills=3 plugins=1 zip=4 generatedAt=2026-10-05T01:02:03.000Z"
  );
});

test("snapshot.json 업로드는 같은 문자열을 installed-tools 버킷에 upsert 하고 홈 경로가 있으면 막는다", async () => {
  const { uploadSnapshot, SNAPSHOT_KEY } = await import("../scripts/scan-installed-tools.mjs");
  const calls = [];
  const storage = (error = null) => ({
    from(bucket) {
      return {
        async upload(key, body, options) {
          calls.push({ bucket, key, body, options });
          return { error };
        },
      };
    },
  });
  const json = '{"generatedAt":"x","tools":[]}\n';
  await uploadSnapshot(storage(), json);
  assert.equal(SNAPSHOT_KEY, "snapshot.json");
  assert.deepEqual(calls, [
    {
      bucket: "installed-tools",
      key: "snapshot.json",
      body: json,
      options: { contentType: "application/json", upsert: true },
    },
  ]);
  // 업로드 실패는 에러로 올라가 종료 코드 1 이 된다
  await assert.rejects(uploadSnapshot(storage({ message: "boom" }), json), /스냅샷 업로드 실패/);
  // 홈 경로가 섞이면 업로드 전에 멈춘다
  calls.length = 0;
  await assert.rejects(uploadSnapshot(storage(), '{"p":"/Users/x"}'));
  assert.equal(calls.length, 0);
});
