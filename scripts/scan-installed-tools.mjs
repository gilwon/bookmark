// 이 머신의 Claude·Codex·Grok·Gemini 스킬과 플러그인을 훑어 src/data/installed-tools.json 스냅샷을 만든다
import { lstat, readFile, readdir, readlink, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_PATH = fileURLToPath(new URL("../src/data/installed-tools.json", import.meta.url));

/** 이름 정렬(가나다·알파벳 순). */
const byName = (a, b) => a.name.localeCompare(b.name, "ko");

/** 파일이 있으면 텍스트를, 없으면 null 을 돌려준다. */
async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** JSON 파일을 읽는다. 없거나 깨졌으면 null. */
async function readJson(path) {
  const text = await readText(path);
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 경로가 존재하는지(심볼릭 링크는 따라가서) 확인한다. */
async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** 디렉터리 항목 이름 목록. 없으면 빈 배열. */
async function listNames(dir) {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/** 양끝 따옴표를 벗긴다. */
function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * SKILL.md 프론트매터에서 description 을 꺼낸다.
 * 한 줄 값과 들여쓴 여러 줄 값(>, |, 빈 값 다음 줄)만 처리하고, 실패하면 빈 문자열.
 */
export function parseDescription(text) {
  try {
    const lines = String(text).split(/\r?\n/);
    if (lines[0]?.trim() !== "---") return "";
    const end = lines.indexOf("---", 1);
    const front = lines.slice(1, end === -1 ? lines.length : end);
    const i = front.findIndex((l) => /^description\s*:/.test(l));
    if (i === -1) return "";
    const value = front[i].replace(/^description\s*:/, "").trim();
    if (value && !/^[>|][+-]?$/.test(value)) return unquote(value);
    // 여러 줄 값은 들여쓴 다음 줄을 들여쓰기가 끝날 때까지 모은다
    const parts = [];
    for (const line of front.slice(i + 1)) {
      if (line.trim() === "") continue;
      if (!/^\s/.test(line)) break;
      parts.push(line.trim());
    }
    return unquote(parts.join(" "));
  } catch {
    return "";
  }
}

/** 심볼릭 링크 대상이 ~/.agents/skills 를 가리키면 shared, 아니면 기본 출처. */
export function skillSource(linkTarget, defaultSource) {
  return linkTarget && linkTarget.includes(".agents/skills") ? "shared" : defaultSource;
}

/** 스킬 폴더를 읽는다. 점으로 시작하는 항목과 SKILL.md 가 없는 항목은 건너뛴다. */
export async function listSkills(dir, defaultSource) {
  const skills = [];
  for (const name of await listNames(dir)) {
    if (name.startsWith(".")) continue;
    const path = join(dir, name);
    const text = await readText(join(path, "SKILL.md"));
    if (text == null) continue;
    let target = null;
    if ((await lstat(path)).isSymbolicLink()) target = await readlink(path);
    skills.push({
      name,
      description: parseDescription(text),
      source: skillSource(target, defaultSource),
    });
  }
  return skills.sort(byName);
}

/** 플러그인 폴더의 매니페스트 설명과 포함 스킬 수. 경로 자체는 결과에 넣지 않는다. */
export async function readPluginInfo(dir) {
  let description = "";
  for (const sub of [".claude-plugin", ".codex-plugin", ".plugin"]) {
    const manifest = await readJson(join(dir, sub, "plugin.json"));
    if (manifest) {
      description = typeof manifest.description === "string" ? manifest.description : "";
      break;
    }
  }
  let skillCount = 0;
  const skillsDir = join(dir, "skills");
  for (const name of await listNames(skillsDir)) {
    if (await exists(join(skillsDir, name, "SKILL.md"))) skillCount++;
  }
  return { description, skillCount };
}

/** "이름@마켓" 키를 이름과 마켓으로 나눈다. */
function splitKey(key) {
  const at = key.lastIndexOf("@");
  return at === -1
    ? { name: key, marketplace: "" }
    : { name: key.slice(0, at), marketplace: key.slice(at + 1) };
}

/** Codex config.toml 에서 enabled = true 인 [plugins."이름@마켓"] 만 뽑는다. */
export function parseCodexPlugins(tomlText) {
  const result = [];
  const header = /^\[plugins\."([^"]+)"\]\s*$/gm;
  let m;
  while ((m = header.exec(tomlText))) {
    // 다음 [ 헤더 전까지가 이 플러그인 블록이다
    const rest = tomlText.slice(header.lastIndex);
    const next = rest.search(/^\[/m);
    const block = next === -1 ? rest : rest.slice(0, next);
    if (/^\s*enabled\s*=\s*true\s*$/m.test(block)) result.push(splitKey(m[1]));
  }
  return result;
}

/** 스냅샷 문자열에 홈 디렉터리 경로가 섞였으면 에러를 던진다. */
export function assertNoHomePaths(jsonText, home = homedir()) {
  if (jsonText.includes("/Users/") || (home && home !== "/" && jsonText.includes(home))) {
    throw new Error("스냅샷에 홈 디렉터리 경로가 들어 있다. 쓰기를 중단한다.");
  }
}

/** Claude 스킬과 플러그인. */
async function scanClaude(home) {
  const skills = await listSkills(join(home, ".claude/skills"), "user");
  const installed = await readJson(join(home, ".claude/plugins/installed_plugins.json"));
  const plugins = [];
  for (const [key, entries] of Object.entries(installed?.plugins ?? {})) {
    const first = Array.isArray(entries) ? entries[0] : null;
    const info = first?.installPath
      ? await readPluginInfo(first.installPath)
      : { description: "", skillCount: 0 };
    plugins.push({ ...splitKey(key), version: first?.version ?? "", ...info });
  }
  return { id: "claude", label: "Claude", skills, plugins };
}

/** Codex 스킬과 활성 플러그인. 버전은 캐시의 버전 폴더 이름(정렬 마지막)이다. */
async function scanCodex(home) {
  const skills = await listSkills(join(home, ".codex/skills"), "user");
  const toml = (await readText(join(home, ".codex/config.toml"))) ?? "";
  const plugins = [];
  for (const { name, marketplace } of parseCodexPlugins(toml)) {
    const base = join(home, ".codex/plugins/cache", marketplace, name);
    const versions = (await listNames(base)).filter((v) => !v.startsWith(".")).sort();
    const version = versions.at(-1) ?? "";
    const info = version
      ? await readPluginInfo(join(base, version))
      : { description: "", skillCount: 0 };
    plugins.push({ name, version, marketplace, ...info });
  }
  return { id: "codex", label: "Codex", skills, plugins };
}

/** Grok 사용자·번들 스킬과 registry.json 의 플러그인. */
async function scanGrok(home) {
  const skills = [
    ...(await listSkills(join(home, ".grok/skills"), "user")),
    ...(await listSkills(join(home, ".grok/bundled/skills"), "bundled")),
  ].sort(byName);
  const registry = await readJson(join(home, ".grok/installed-plugins/registry.json"));
  const plugins = [];
  for (const repo of Object.values(registry?.repos ?? {})) {
    const marketplace = repo?.marketplace?.source_display_name ?? "";
    for (const [name, meta] of Object.entries(repo?.plugins ?? {})) {
      let info = { description: "", skillCount: 0 };
      if (repo.path) {
        // 매니페스트는 plugin_subdir 먼저, 없으면 저장소 루트에서 찾는다
        const sub = repo.marketplace?.plugin_subdir;
        const subDir = sub ? join(repo.path, sub) : null;
        info = await readPluginInfo(subDir && (await exists(subDir)) ? subDir : repo.path);
      }
      plugins.push({ name, version: meta?.version ?? "", marketplace, ...info });
    }
  }
  return { id: "grok", label: "Grok", skills, plugins };
}

/** Gemini 스킬. 플러그인은 아직 없다. */
async function scanGemini(home) {
  const skills = await listSkills(join(home, ".gemini/skills"), "user");
  return { id: "gemini", label: "Gemini", skills, plugins: [] };
}

/** 네 도구를 모두 훑어 스냅샷 객체를 만든다. */
export async function scanAll(home = homedir()) {
  const tools = await Promise.all([scanClaude(home), scanCodex(home), scanGrok(home), scanGemini(home)]);
  for (const tool of tools) tool.plugins.sort(byName);
  return { generatedAt: new Date().toISOString(), tools };
}

async function main() {
  const snapshot = await scanAll();
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  assertNoHomePaths(json);
  await writeFile(OUT_PATH, json);
  for (const t of snapshot.tools) {
    console.log(`${t.label}: 스킬 ${t.skills.length}개, 플러그인 ${t.plugins.length}개`);
  }
}

// 직접 실행할 때만 스캔한다(import 시에는 실행하지 않는다)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
