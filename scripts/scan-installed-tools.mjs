// 이 머신의 Claude·Codex·Grok·Gemini 스킬과 플러그인을 훑어 src/data/installed-tools.json 스냅샷을 만든다
import { createReadStream } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import { lstat, mkdtemp, readFile, readdir, readlink, realpath, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

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
 * 한 줄 값과 들여쓴 여러 줄 값(첫 줄 값 뒤 이어쓰기, >, |, 빈 값 다음 줄)만 처리하고, 실패하면 빈 문자열.
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
    // 첫 줄 값(있으면)에 이어 들여쓴 다음 줄을 들여쓰기가 끝날 때까지 모은다
    const parts = value && !/^[>|][+-]?$/.test(value) ? [value] : [];
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
    // dir 은 ZIP 단계에서만 쓰고 스냅샷에 쓰기 전에 지운다
    skills.push({
      name,
      description: parseDescription(text),
      source: skillSource(target, defaultSource),
      dir: path,
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

/**
 * GitHub 저장소 주소만 통과시킨다. 문자열 또는 { url } 객체(plugin.json repository)를 받는다.
 * `https://github.com/` 로 시작하지 않거나 자격 증명(`user:pass@`)·쿼리가 든 값은 버리고, 끝 `/` 와 `.git` 을 뗀다.
 */
export function githubRepoUrl(raw) {
  const value = typeof raw === "string" ? raw : typeof raw?.url === "string" ? raw.url : "";
  const url = value.trim().replace(/\/+$/, "").replace(/\.git$/, "");
  // 경로에는 영문·숫자·._- 와 / 만 허용해 @·?·# 같은 자격 증명·토큰 자리를 막는다
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/[\w./-]*)?$/.test(url) ? url : undefined;
}

/** GitHub 주소에서 `owner/repo` 를 꺼낸다. */
export function githubSlug(url) {
  return url.replace("https://github.com/", "").split("/").slice(0, 2).join("/");
}

/** Codex config.toml 의 [marketplaces.<마켓>] 블록에서 source_type 과 source 를 뽑는다. */
export function parseCodexMarketplaces(tomlText) {
  const result = {};
  const header = /^\[marketplaces\.([^\]]+)\]\s*$/gm;
  let m;
  while ((m = header.exec(tomlText))) {
    const rest = tomlText.slice(header.lastIndex);
    const next = rest.search(/^\[/m);
    const block = next === -1 ? rest : rest.slice(0, next);
    const field = (key) => {
      const f = new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, "m").exec(block);
      return f ? unquote(f[1]) : "";
    };
    result[unquote(m[1])] = { sourceType: field("source_type"), source: field("source") };
  }
  return result;
}

/**
 * Claude 플러그인 출처. plugin.json 의 repository·homepage 가 GitHub 면 링크로 우선하고,
 * 명령은 known_marketplaces 의 마켓 저장소(source=github) 기준 두 줄이다.
 */
export function claudePluginSource({ name, marketplace, manifest, market }) {
  const marketUrl =
    market?.source?.source === "github" && typeof market.source.repo === "string"
      ? githubRepoUrl(`https://github.com/${market.source.repo}`)
      : undefined;
  const repoUrl = githubRepoUrl(manifest?.repository) ?? githubRepoUrl(manifest?.homepage) ?? marketUrl;
  const out = {};
  if (repoUrl) out.repoUrl = repoUrl;
  if (marketUrl) {
    out.installCommands = [
      `/plugin marketplace add ${githubSlug(marketUrl)}`,
      `/plugin install ${name}@${marketplace}`,
    ];
  }
  return out;
}

/** Codex 플러그인 출처. source_type = "git" 이고 GitHub 주소인 마켓만 쓴다(로컬 경로 마켓은 없음). */
export function codexPluginSource({ name, marketplace }, markets) {
  const m = markets[marketplace];
  const repoUrl = m?.sourceType === "git" ? githubRepoUrl(m.source) : undefined;
  if (!repoUrl) return {};
  return {
    repoUrl,
    installCommands: [
      `codex plugin marketplace add ${githubSlug(repoUrl)}`,
      `codex plugin add ${name}@${marketplace}`,
    ],
  };
}

/** Grok 플러그인 출처. registry.json kind.url 이 링크, 명령은 ~/.grok/docs 09-plugins.md 와 `grok plugin install --help` 에서 확인한 형식이다. */
export function grokPluginSource(kind) {
  const repoUrl = githubRepoUrl(kind?.url);
  if (!repoUrl) return {};
  // --trust 는 붙이지 않는다. 없으면 Grok 이 출처와 경고를 보이고 확인을 받는다
  return { repoUrl, installCommands: [`grok plugin install ${githubSlug(repoUrl)}`] };
}

/** 스킬 출처. ~/.agents/.skill-lock.json 에 같은 이름이 있으면 그 sourceUrl·source 를 쓴다. 번들 스킬은 출처 없음. */
export function lockSkillSource(skill, lock) {
  if (skill.source === "bundled") return {};
  const entry = lock?.skills?.[skill.name];
  const repoUrl = githubRepoUrl(entry?.sourceUrl);
  if (!repoUrl) return {};
  // source 가 owner/repo 형식이 아니면 링크에서 만든다(이상한 값이 명령에 섞이지 않게)
  const source = /^[\w.-]+\/[\w.-]+$/.test(entry.source ?? "") ? entry.source : githubSlug(repoUrl);
  return { repoUrl, installCommands: [`npx skills add ${source} --skill ${skill.name}`] };
}

/** ZIP 대상 스킬인지. 출처가 없고 번들이 아닌 스킬만 대상이다. */
export function isZipTarget(skill) {
  return !skill.repoUrl && skill.source !== "bundled";
}

/** Storage 키는 ASCII 만 받으므로 한글 등 이름은 UTF-8 hex 로 바꾼다 */
export function zipObjectName(name) {
  return /^[\w.-]+$/.test(name) ? name : `u-${Buffer.from(name, "utf8").toString("hex")}`;
}

/** 이전 스냅샷에서 같은 도구/이름의 zipKey 를 이어받는다. 지금도 ZIP 대상인 스킬에만 붙인다. */
export function inheritZipKeys(snapshot, previous) {
  const keys = new Map();
  for (const t of previous?.tools ?? []) {
    for (const s of t.skills ?? []) if (s.zipKey) keys.set(`${t.id}/${s.name}`, s.zipKey);
  }
  for (const t of snapshot.tools) {
    for (const s of t.skills) {
      const key = keys.get(`${t.id}/${s.name}`);
      if (key && isZipTarget(s)) s.zipKey = key;
    }
  }
}

/** ZIP 파일 1개 상한(1MB)과 스킬 하나의 압축 전 합계 상한(5MB). */
export const ZIP_FILE_LIMIT = 1024 * 1024;
export const ZIP_SKILL_LIMIT = 5 * 1024 * 1024;

/** ZIP 에서 뺄 파일인지. rel 은 스킬 폴더 기준 상대 경로(/ 구분), 이름 비교는 대소문자를 무시한다. */
export function isExcludedFile(rel, size) {
  const parts = rel.split("/");
  if (parts.some((p) => p === ".git" || p === "node_modules")) return true;
  const base = parts.at(-1).toLowerCase();
  if (base === ".ds_store" || base.startsWith(".env") || base.endsWith(".pem") || base.endsWith(".key")) return true;
  if (/credential|secret|token|id_rsa/.test(base)) return true;
  return size > ZIP_FILE_LIMIT;
}

/** 파일 목록 [{rel, size}] 에서 넣을 것과 뺄 것을 나누고, 남은 파일 합계가 5MB 를 넘으면 skipped. */
export function planZipEntries(files) {
  const keep = files.filter((f) => !isExcludedFile(f.rel, f.size));
  const total = keep.reduce((sum, f) => sum + f.size, 0);
  return { keep, excludedCount: files.length - keep.length, total, skipped: total > ZIP_SKILL_LIMIT };
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
  const markets = (await readJson(join(home, ".claude/plugins/known_marketplaces.json"))) ?? {};
  const plugins = [];
  for (const [key, entries] of Object.entries(installed?.plugins ?? {})) {
    const first = Array.isArray(entries) ? entries[0] : null;
    const info = first?.installPath
      ? await readPluginInfo(first.installPath)
      : { description: "", skillCount: 0 };
    const manifest = first?.installPath
      ? await readJson(join(first.installPath, ".claude-plugin", "plugin.json"))
      : null;
    const { name, marketplace } = splitKey(key);
    plugins.push({
      name,
      marketplace,
      version: first?.version ?? "",
      ...info,
      ...claudePluginSource({ name, marketplace, manifest, market: markets[marketplace] }),
    });
  }
  return { id: "claude", label: "Claude", skills, plugins };
}

/** Codex 스킬과 활성 플러그인. 버전은 캐시의 버전 폴더 이름(정렬 마지막)이다. */
async function scanCodex(home) {
  const skills = await listSkills(join(home, ".codex/skills"), "user");
  const toml = (await readText(join(home, ".codex/config.toml"))) ?? "";
  const markets = parseCodexMarketplaces(toml);
  const plugins = [];
  for (const { name, marketplace } of parseCodexPlugins(toml)) {
    const base = join(home, ".codex/plugins/cache", marketplace, name);
    const versions = (await listNames(base)).filter((v) => !v.startsWith(".")).sort();
    const version = versions.at(-1) ?? "";
    const info = version
      ? await readPluginInfo(join(base, version))
      : { description: "", skillCount: 0 };
    plugins.push({ name, version, marketplace, ...info, ...codexPluginSource({ name, marketplace }, markets) });
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
      plugins.push({ name, version: meta?.version ?? "", marketplace, ...info, ...grokPluginSource(repo?.kind) });
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
  const lock = await readJson(join(home, ".agents/.skill-lock.json"));
  for (const tool of tools) {
    tool.plugins.sort(byName);
    for (const s of tool.skills) Object.assign(s, lockSkillSource(s, lock));
  }
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

/** 폴더 아래 일반 파일을 모은다. 심볼릭 링크는 따라가지 않고 개수만 센다. */
async function walkFiles(root) {
  const files = [];
  let links = 0;
  async function walk(dir, rel) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      const abs = join(dir, e.name);
      if (e.isSymbolicLink()) links++;
      else if (e.isDirectory()) await walk(abs, r);
      else if (e.isFile()) files.push({ rel: r, abs, size: (await lstat(abs)).size });
    }
  }
  await walk(root, "");
  return { files, links };
}

/** 바이트 수를 MB 문자열로. */
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;

/** 프로젝트 .env.local 을 기존 import 스크립트와 같은 방식으로 읽어 비어 있는 환경변수만 채운다. */
function loadEnvLocal() {
  const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

/**
 * ZIP 단계. 대상 스킬을 realpath 로 묶어 임시 폴더에 ZIP 을 만들고 요약을 출력한다.
 * upload 가 참이면 Supabase 비공개 버킷에 올리고 성공한 스킬에 zipKey 를 붙인다. 임시 폴더는 항상 지운다.
 */
async function zipStage(snapshot, { upload }) {
  // 같은 실제 폴더를 가리키는 스킬은 한 번만 만든다. 키는 처음 만난 도구 기준
  const groups = new Map();
  const unreadable = [];
  for (const t of snapshot.tools) {
    for (const s of t.skills) {
      if (!isZipTarget(s)) continue;
      let real;
      try {
        real = await realpath(s.dir);
      } catch {
        unreadable.push(`${t.id}/${s.name}`);
        continue;
      }
      const g = groups.get(real) ?? { real, key: `${t.id}/${zipObjectName(s.name)}.zip`, name: s.name, skills: [] };
      g.skills.push(s);
      groups.set(real, g);
    }
  }
  const tmp = await mkdtemp(join(tmpdir(), "installed-tools-"));
  const built = [];
  const skipped = [];
  let excluded = 0;
  let links = 0;
  let rawTotal = 0;
  let zipTotal = 0;
  try {
    for (const g of groups.values()) {
      const walked = await walkFiles(g.real);
      links += walked.links;
      const plan = planZipEntries(walked.files);
      excluded += plan.excludedCount;
      if (plan.skipped) {
        skipped.push(`${g.key} (${mb(plan.total)})`);
        continue;
      }
      const entries = {};
      for (const f of plan.keep) entries[`${g.name}/${f.rel}`] = new Uint8Array(await readFile(f.abs));
      const zipPath = join(tmp, g.key.replace("/", "__"));
      const bytes = zipSync(entries);
      await writeFile(zipPath, bytes);
      rawTotal += plan.total;
      zipTotal += bytes.length;
      built.push({ ...g, zipPath });
    }
    console.log(
      `ZIP 대상 스킬 ${[...groups.values()].reduce((n, g) => n + g.skills.length, 0)}개(고유 폴더 ${groups.size}개), 생성 ${built.length}개`
    );
    console.log(`  압축 전 합계 ${mb(rawTotal)}, ZIP 합계 ${mb(zipTotal)}`);
    console.log(`  제외 파일 ${excluded}개, 건너뛴 심볼릭 링크 ${links}개`);
    console.log(`  5MB 초과로 건너뛴 스킬 ${skipped.length}개${skipped.length ? `: ${skipped.join(", ")}` : ""}`);
    if (unreadable.length) console.log(`  폴더를 읽지 못한 스킬: ${unreadable.join(", ")}`);
    if (!upload) {
      console.log("  --dry-run: 업로드하지 않고 임시 ZIP 을 지운다");
      return { uploaded: 0, storage: null };
    }
    loadEnvLocal();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.log("  업로드 건너뜀: NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 없다");
      return { uploaded: 0, storage: null };
    }
    // 기본 실행과 테스트가 supabase 모듈을 읽지 않게 업로드 때만 불러온다
    const { createClient } = await import("@supabase/supabase-js");
    const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
    if ((await storage.getBucket(BUCKET)).error) {
      const { error } = await storage.createBucket(BUCKET, { public: false });
      if (error) throw new Error(`버킷 생성 실패: ${error.message}`);
    }
    let ok = 0;
    for (const b of built) {
      const { error } = await storage
        .from(BUCKET)
        .upload(b.key, await readFile(b.zipPath), { contentType: "application/zip", upsert: true });
      if (error) {
        console.log(`  업로드 실패 ${b.key}: ${error.message}`);
        continue;
      }
      for (const s of b.skills) s.zipKey = b.key;
      ok++;
    }
    console.log(`  업로드 ${ok}/${built.length}개`);
    // --sync 가 같은 클라이언트로 snapshot.json 을 올리도록 함께 돌려준다
    return { uploaded: ok, storage };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/** ZIP 을 올리는 Supabase Storage 비공개 버킷 */
const BUCKET = "installed-tools";

/** --sync 가 스냅샷을 올리는 Storage 키 */
export const SNAPSHOT_KEY = "snapshot.json";

/**
 * 스냅샷 JSON 문자열을 버킷의 snapshot.json 으로 덮어 올린다.
 * 홈 경로 가드를 다시 거치고, 로컬 파일과 같은 문자열을 그대로 보낸다. 실패하면 에러를 던진다
 */
export async function uploadSnapshot(storage, json) {
  assertNoHomePaths(json);
  const { error } = await storage
    .from(BUCKET)
    .upload(SNAPSHOT_KEY, json, { contentType: "application/json", upsert: true });
  if (error) throw new Error(`스냅샷 업로드 실패: ${error.message}`);
}

/** 동기화 API 가 파싱하는 마지막 요약 줄. 스킬·플러그인은 전 도구 합계, zip 은 이번에 올린 ZIP 수 */
export function syncSummaryLine(snapshot, zip) {
  const sum = (kind) => snapshot.tools.reduce((n, t) => n + t[kind].length, 0);
  return `SYNC_SUMMARY skills=${sum("skills")} plugins=${sum("plugins")} zip=${zip} generatedAt=${snapshot.generatedAt}`;
}

async function main() {
  const args = process.argv.slice(2);
  // --sync 는 --upload 의 ZIP 업로드를 그대로 쓰고 snapshot.json 업로드를 더한다
  const sync = args.includes("--sync");
  const upload = sync || args.includes("--upload");
  const snapshot = await scanAll();
  // 업로드 없이 다시 돌려도 이전 zipKey 를 잃지 않게 이어받는다
  inheritZipKeys(snapshot, await readJson(OUT_PATH));
  const zip =
    upload || args.includes("--dry-run")
      ? await zipStage(snapshot, { upload })
      : { uploaded: 0, storage: null };
  for (const t of snapshot.tools) for (const s of t.skills) delete s.dir;
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  assertNoHomePaths(json);
  await writeFile(OUT_PATH, json);
  if (sync) {
    if (!zip.storage) throw new Error("동기화 실패: Supabase 환경변수가 없어 스냅샷을 올리지 못했다");
    console.log(`스냅샷 업로드 ${(Buffer.byteLength(json) / 1024).toFixed(1)}KB → ${BUCKET}/${SNAPSHOT_KEY}`);
    await uploadSnapshot(zip.storage, json);
  }
  for (const t of snapshot.tools) {
    const items = [...t.skills, ...t.plugins];
    console.log(
      `${t.label} 출처: 링크 ${items.filter((x) => x.repoUrl).length}개(스킬 ${t.skills.filter((x) => x.repoUrl).length}·플러그인 ${t.plugins.filter((x) => x.repoUrl).length}), 설치 명령 ${items.filter((x) => x.installCommands).length}개, zipKey ${t.skills.filter((x) => x.zipKey).length}개`
    );
  }
  // 번역 파일이 없으면 전부 누락으로 본다
  const ko = await readFile(KO_PATH, "utf8").then(JSON.parse, () => ({}));
  console.log(`한글 번역 누락 ${missingTranslations(snapshot, ko).length}개`);
  for (const t of snapshot.tools) {
    console.log(`${t.label}: 스킬 ${t.skills.length}개, 플러그인 ${t.plugins.length}개`);
    const used = [...t.skills, ...t.plugins].filter((x) => x.uses > 0).sort((a, b) => b.uses - a.uses);
    const top = used.slice(0, 5).map((x) => `${x.name} ${x.uses}`).join(", ");
    console.log(`  사용 ${used.length}개${top ? ` · 상위 ${top}` : ""}`);
  }
  // 요약 줄은 항상 맨 마지막에 출력한다(API 가 출력 꼬리에서 찾는다)
  if (sync) console.log(syncSummaryLine(snapshot, zip.uploaded));
}

// 직접 실행할 때만 스캔한다(import 시에는 실행하지 않는다)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
