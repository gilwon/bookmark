// 이 머신의 Claude·Codex·Grok·Gemini 스킬과 플러그인을 훑어 src/data/installed-tools.json 스냅샷을 만든다
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir, readlink, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const OUT_PATH = fileURLToPath(new URL("../src/data/installed-tools.json", import.meta.url));
// 한글 번역 파일. 스캔은 읽기만 하고 절대 쓰지 않는다
const KO_PATH = fileURLToPath(new URL("../src/data/installed-tools-ko.json", import.meta.url));

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

/** 이름별 횟수를 하나 올린다. */
function bump(map, name) {
  map[name] = (map[name] ?? 0) + 1;
}

/**
 * 호출 이름 하나를 스킬 또는 플러그인 횟수에 더한다.
 * `플러그인:스킬` 형태는 설치된 플러그인에만 더하고 스킬 쪽에는 넣지 않는다(오탐 방지).
 * 접두 없는 이름은 설치된 스킬과 정확히 같을 때만 센다.
 */
function addName(counts, installed, raw) {
  if (typeof raw !== "string") return;
  const name = raw.replace(/^\//, "");
  const colon = name.indexOf(":");
  if (colon !== -1) {
    const plugin = name.slice(0, colon);
    if (installed.plugins.includes(plugin)) bump(counts.plugins, plugin);
    return;
  }
  if (installed.skills.includes(name)) bump(counts.skills, name);
}

/** `mcp__plugin_<플러그인>_` 도구 이름에서 설치된 플러그인을 찾는다. 하이픈은 언더스코어로도 비교하고 가장 긴 일치를 고른다. */
function mcpPlugin(toolName, plugins) {
  let best = null;
  for (const p of plugins) {
    const hit = [p, p.replaceAll("-", "_")].some((v) => toolName.startsWith(`mcp__plugin_${v}_`));
    if (hit && (!best || p.length > best.length)) best = p;
  }
  return best;
}

/**
 * Claude 세션 jsonl 줄들에서 스킬·플러그인 사용 횟수를 센다.
 * lines 는 줄 문자열의 (비동기) 반복자, installed 는 { skills: 이름[], plugins: 이름[] }.
 * Skill 도구 호출·mcp 플러그인 도구는 tool_use id 로, 슬래시 명령은 메시지 uuid 로 중복을 없앤다.
 * 결과는 숫자만 담은 { skills: {이름: 횟수}, plugins: {이름: 횟수} }.
 */
export async function countUsage(lines, installed) {
  const counts = { skills: {}, plugins: {} };
  const seen = new Set();
  // id 가 없으면 중복 판정 없이 센다
  const firstTime = (id) => {
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  };
  for await (const line of lines) {
    // 대용량 로그라 관련 문자열이 없는 줄은 파싱하지 않는다
    if (!line.includes('"Skill"') && !line.includes("<command-") && !line.includes("mcp__plugin_")) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const content = o?.message?.content;
    if (o?.type === "assistant" && Array.isArray(content)) {
      for (const b of content) {
        if (b?.type !== "tool_use" || typeof b.name !== "string") continue;
        if (b.name === "Skill") {
          if (firstTime(b.id)) addName(counts, installed, b.input?.skill);
        } else if (b.name.startsWith("mcp__plugin_")) {
          const p = mcpPlugin(b.name, installed.plugins);
          if (p && firstTime(b.id)) bump(counts.plugins, p);
        }
      }
    } else if (o?.type === "user") {
      // tool_result 블록은 도구 출력이라 건너뛰고, 문자열이나 text 블록만 본다
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.filter((b) => b?.type === "text").map((b) => b.text).join("\n")
            : "";
      // 실제 슬래시 명령 메시지는 <command-message> 나 <command-name> 으로 시작한다
      if (!/^\s*<command-(?:message|name)>/.test(text)) continue;
      const m = /<command-name>([^<]+)<\/command-name>/.exec(text);
      if (m && firstTime(o.uuid)) addName(counts, installed, m[1].trim());
    }
  }
  return counts;
}

/**
 * Grok prompt_history.jsonl 줄들에서 `/이름` 으로 시작하는 프롬프트를 센다.
 * 한 줄이 제출 1건이라 중복 제거는 하지 않는다. `/Users` 같은 경로는 설치 이름 정확 일치로 걸러진다.
 */
export async function countSlashPrompts(lines, installed) {
  const counts = { skills: {}, plugins: {} };
  for await (const line of lines) {
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const m = typeof o?.prompt === "string" ? /^\/(\S+)/.exec(o.prompt) : null;
    if (m) addName(counts, installed, m[1]);
  }
  return counts;
}

/** dir 아래 모든 jsonl 파일(파일 이름 조건 통과분)을 줄 단위로 흘려 준다. 메모리를 아끼려고 스트리밍한다. */
async function* jsonlLines(dir, keep = () => true) {
  let files;
  try {
    files = await readdir(dir, { recursive: true });
  } catch {
    return;
  }
  for (const f of files) {
    if (!f.endsWith(".jsonl") || !keep(basename(f))) continue;
    yield* createInterface({ input: createReadStream(join(dir, f)), crlfDelay: Infinity });
  }
}

/** 횟수 맵을 각 항목의 uses 에 붙인다. 없으면 0. */
function applyUses(tool, counts = { skills: {}, plugins: {} }) {
  for (const s of tool.skills) s.uses = counts.skills[s.name] ?? 0;
  for (const p of tool.plugins) p.uses = counts.plugins[p.name] ?? 0;
}

/** 도구의 설치 이름 목록. */
function installedNames(tool) {
  return { skills: tool.skills.map((s) => s.name), plugins: tool.plugins.map((p) => p.name) };
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
  const [claude, codex, grok, gemini] = tools;
  applyUses(claude, await countUsage(jsonlLines(join(home, ".claude/projects")), installedNames(claude)));
  applyUses(
    grok,
    await countSlashPrompts(
      jsonlLines(join(home, ".grok/sessions"), (n) => n === "prompt_history.jsonl"),
      installedNames(grok)
    )
  );
  // Codex 는 구조화된 스킬 신호가 최신 기록에만 있고 텍스트 멘션은 중복 기록돼 횟수가 불확실하다. Gemini 는 채팅 기록이 없다. 둘 다 0 으로 둔다
  applyUses(codex);
  applyUses(gemini);
  return { generatedAt: new Date().toISOString(), tools };
}

/**
 * 설명이 비어 있지 않고 한글이 없는데 번역 파일에 키(도구id/skill|plugin/이름)가 없는 항목의 키 목록.
 * 같은 이름이 출처만 달리 겹치면 `키/출처`(스킬 source, 플러그인 marketplace)도 키로 인정한다
 */
export function missingTranslations(snapshot, ko) {
  const missing = [];
  for (const tool of snapshot.tools) {
    for (const kind of ["skill", "plugin"]) {
      for (const item of tool[`${kind}s`]) {
        const key = `${tool.id}/${kind}/${item.name}`;
        const from = kind === "skill" ? item.source : item.marketplace;
        if (item.description && !/[가-힣]/.test(item.description) && !ko[`${key}/${from}`] && !ko[key]) {
          missing.push(key);
        }
      }
    }
  }
  return missing;
}

async function main() {
  const snapshot = await scanAll();
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  assertNoHomePaths(json);
  await writeFile(OUT_PATH, json);
  // 번역 파일이 없으면 전부 누락으로 본다
  const ko = await readFile(KO_PATH, "utf8").then(JSON.parse, () => ({}));
  console.log(`한글 번역 누락 ${missingTranslations(snapshot, ko).length}개`);
  for (const t of snapshot.tools) {
    console.log(`${t.label}: 스킬 ${t.skills.length}개, 플러그인 ${t.plugins.length}개`);
    const used = [...t.skills, ...t.plugins].filter((x) => x.uses > 0).sort((a, b) => b.uses - a.uses);
    const top = used.slice(0, 5).map((x) => `${x.name} ${x.uses}`).join(", ");
    console.log(`  사용 ${used.length}개${top ? ` · 상위 ${top}` : ""}`);
  }
}

// 직접 실행할 때만 스캔한다(import 시에는 실행하지 않는다)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
