// 스킬 도감의 55개 스킬 상세와 설치 프롬프트를 pages·prompts에 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    const value = match[2].trim();
    const quoted = value.match(/^(["'])(.*)\1$/);
    process.env[match[1].trim()] = quoted ? quoted[2] : value;
  }
}

const SOURCE = "https://skill-dogam.vercel.app/";
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const CATEGORY_PREFIX = "스킬 도감";
const EXPECTED_COUNT = 82;
const isCheck = process.argv.includes("--check");

const tsx = createRequire(import.meta.url)("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = createRequire(import.meta.url)(
  resolve(root, "src/lib/markdown-to-tiptap.ts")
);

function required(element, selector, context) {
  const found = element?.querySelector(selector);
  if (!found) throw new Error(`${context}에서 ${selector} 구조를 찾지 못했습니다.`);
  return found;
}

function text(element, context) {
  const value = element?.textContent?.trim() ?? "";
  if (!value) throw new Error(`${context}의 텍스트가 비어 있습니다.`);
  return value;
}

function normalizedText(element, context) {
  return text(element, context).replace(/\s+/g, " ").trim();
}

function absoluteUrl(href, context) {
  if (!href) throw new Error(`${context}의 링크가 비어 있습니다.`);
  try {
    return new URL(href, SOURCE).href;
  } catch (error) {
    throw new Error(`${context}의 링크가 올바르지 않습니다. ${href}`, { cause: error });
  }
}

function rowTitle(row, context) {
  const title = required(row, ".row-t", context).cloneNode(true);
  for (const badge of title.querySelectorAll(".tag-n, .tag-j")) badge.remove();
  return normalizedText(title, `${context} 제목`);
}

function codeFence(value) {
  const longest = Math.max(...[...value.matchAll(/`+/g)].map((match) => match[0].length), 0);
  return `${"`".repeat(Math.max(3, longest + 1))}text\n${value}\n${"`".repeat(Math.max(3, longest + 1))}`;
}

function pageMarkdown(skill) {
  const lines = [
    `# ${skill.title}`,
    "",
    `- 스킬 ID. \`${skill.id}\``,
    `- 분류. ${skill.category}`,
    `- 형식. ${skill.form}`,
    `- 목록 설명. ${skill.rowSummary}`,
    "",
    "## 원본 링크",
    `[원본 보기](${skill.sourceUrl})`,
    "",
    "## 소개",
    skill.introduction,
    "",
    "## 할 수 있는 일",
    ...skill.capabilities.map((item) => `- ${item}`),
    "",
    "## 누구에게 쓸모 있나",
    skill.usefulFor,
    "",
    "## 이렇게 달라집니다",
    ...skill.beforeAfter.map(({ key, value }) => `- **${key}**. ${value}`),
  ];

  if (skill.shots.length) {
    lines.push("", "## 이미지");
    for (const shot of skill.shots) {
      lines.push(`- 원본 이미지. [${shot.alt}](${shot.url})`);
      if (shot.caption) lines.push(`- 설명. ${shot.caption}`);
    }
  }

  if (skill.numbers.length) {
    lines.push("", "## 수치 카드");
    for (const number of skill.numbers) {
      lines.push(`- **${number.value}**. ${number.description} (${number.note})`);
    }
  }

  if (skill.javisNote) lines.push("", "## 자비스 풀스택에서는", skill.javisNote);
  if (skill.caution) lines.push("", "## 알아두기", skill.caution);

  lines.push("", "## 별·갱신·라이선스");
  for (const [index, value] of skill.metadata.entries()) {
    const label = ["별", "최근 갱신", "라이선스"][index] ?? `메타 ${index + 1}`;
    lines.push(`- ${label}. ${value}`);
  }
  lines.push(`- 원본 보기. [${skill.sourceUrl}](${skill.sourceUrl})`);

  if (skill.sources.length) {
    lines.push("", "## 찾아본 자료");
    for (const source of skill.sources) lines.push(`- [${source.label}](${source.url})`);
  }

  lines.push("", "## 설치 프롬프트", skill.installHeading, codeFence(skill.install));
  return lines.join("\n");
}

function parseSkill(row, sheet, index) {
  const context = `${index + 1}번째 스킬`;
  const id = row.dataset.id;
  if (!id) throw new Error(`${context} row에 data-id가 없습니다.`);
  if (!row.dataset.category) throw new Error(`${context} row에 data-category가 없습니다.`);
  if (!row.dataset.form) throw new Error(`${context} row에 data-form이 없습니다.`);
  required(row, ".row-main", context);
  const title = rowTitle(row, context);
  const rowSummary = normalizedText(required(row, ".row-s", context), `${context} 목록 설명`);
  const bodies = [...sheet.querySelectorAll(".sheet-l p.body")];
  if (bodies.length !== 2) throw new Error(`${context}의 소개·대상 본문 수가 2개가 아닙니다.`);
  const capabilities = [...sheet.querySelectorAll(".cans > li")].map((item, itemIndex) =>
    normalizedText(item, `${context} 할 수 있는 일 ${itemIndex + 1}`)
  );
  if (!capabilities.length) throw new Error(`${context}의 할 수 있는 일이 없습니다.`);

  const sourceLink = required(sheet, ".meta a", context);
  const sourceUrl = absoluteUrl(sourceLink.getAttribute("href"), `${context} 원본`);
  const beforeAfter = [...sheet.querySelectorAll(".ba .ba-row")].map((rowItem, rowIndex) => ({
    key: normalizedText(required(rowItem, ".ba-k", `${context} 변화 ${rowIndex + 1}`), `${context} 변화 이름`),
    value: normalizedText(required(rowItem, ".ba-v", `${context} 변화 ${rowIndex + 1}`), `${context} 변화 내용`),
  }));
  if (beforeAfter.length !== 2) throw new Error(`${context}의 지금·붙이면 항목 수가 2개가 아닙니다.`);

  const shots = [...sheet.querySelectorAll(".shot")].map((shot, shotIndex) => {
    const image = required(shot, "img", `${context} 이미지 ${shotIndex + 1}`);
    const src = absoluteUrl(image.getAttribute("src"), `${context} 이미지 ${shotIndex + 1}`);
    const alt = image.getAttribute("alt")?.trim() ?? "";
    if (!alt) throw new Error(`${context} 이미지 ${shotIndex + 1} 대체텍스트가 비어 있습니다.`);
    return {
      url: src,
      alt,
      caption: shot.querySelector("figcaption")?.textContent?.trim() ?? "",
    };
  });
  const metadata = [...sheet.querySelectorAll(".meta > span")].map((item, itemIndex) =>
    normalizedText(item, `${context} 메타 ${itemIndex + 1}`)
  );
  if (metadata.length < 2) throw new Error(`${context}의 별·갱신 메타가 부족합니다.`);
  // .meta > span에는 클래스가 없어 순서로만 라벨을 구분한다. 값 형태를 검증해 순서가 바뀌면 잡아낸다.
  if (!/^별\s/.test(metadata[0])) throw new Error(`${context}의 첫 메타가 별 표기가 아닙니다. ${metadata[0]}`);
  if (!/^최근 갱신 \d{4}-\d{2}-\d{2}$/.test(metadata[1])) {
    throw new Error(`${context}의 두 번째 메타가 최근 갱신 날짜 형식이 아닙니다. ${metadata[1]}`);
  }
  const sources = [...sheet.querySelectorAll(".srcs > a")].map((link, linkIndex) => ({
    url: absoluteUrl(link.getAttribute("href"), `${context} 찾아본 자료 ${linkIndex + 1}`),
    label: normalizedText(link, `${context} 찾아본 자료 ${linkIndex + 1}`),
  }));
  const installCode = required(sheet, ".inst-c", context);
  const install = text(installCode, `${context} 설치 프롬프트`);
  const installHeading = normalizedText(required(sheet, ".inst-h", context), `${context} 설치 안내`);
  const skill = {
    id,
    title,
    category: `${CATEGORY_PREFIX} · ${row.dataset.category}`,
    form: row.dataset.form,
    rowSummary,
    sourceUrl,
    introduction: normalizedText(bodies[0], `${context} 소개`),
    capabilities,
    usefulFor: normalizedText(bodies[1], `${context} 대상`),
    beforeAfter,
    shots,
    numbers: [...sheet.querySelectorAll(".ba-num")].map((item, itemIndex) => ({
      value: normalizedText(required(item, "b", `${context} 수치 ${itemIndex + 1}`), `${context} 수치 값`),
      description: normalizedText(required(item, "span", `${context} 수치 ${itemIndex + 1}`), `${context} 수치 설명`),
      note: normalizedText(required(item, "i", `${context} 수치 ${itemIndex + 1}`), `${context} 수치 출처`),
    })),
    javisNote: sheet.querySelector(".jbox")?.textContent?.trim() ?? "",
    caution: sheet.querySelector(".cau")?.textContent?.trim() ?? "",
    metadata,
    sources,
    installHeading,
    install,
  };
  skill.markdown = pageMarkdown(skill);
  skill.content = JSON.stringify(markdownToTiptapDoc(skill.markdown));
  return skill;
}

async function loadSkills() {
  let response;
  try {
    response = await fetch(SOURCE);
  } catch (error) {
    throw new Error(`원문을 가져오지 못했습니다. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  if (!response.ok) throw new Error(`원문을 가져오지 못했습니다. HTTP ${response.status}`);
  const html = await response.text();
  if (!html.trim()) throw new Error("원문 HTML이 비어 있습니다.");

  const { document } = parseHTML(html);
  const list = document.querySelector("#list");
  if (!list) throw new Error("#list 구조를 찾지 못했습니다.");
  const rows = [...list.querySelectorAll(":scope > button.row")];
  const sheets = [...list.querySelectorAll(":scope > div.sheet")];
  if (rows.length !== EXPECTED_COUNT || sheets.length !== EXPECTED_COUNT) {
    throw new Error(`목록 구조가 예상과 다릅니다. rows ${rows.length}, sheets ${sheets.length}, 예상 ${EXPECTED_COUNT}`);
  }

  const children = [...list.children];
  const seenIds = new Set();
  const skills = rows.map((row, index) => {
    const id = row.dataset.id;
    const sheet = id ? document.getElementById(`sheet-${id}`) : null;
    if (!sheet || sheet.parentNode !== list) throw new Error(`${index + 1}번째 row에 대응하는 sheet가 없습니다.`);
    if (children[children.indexOf(row) + 1] !== sheet) throw new Error(`${index + 1}번째 row와 sheet 순서가 다릅니다.`);
    if (seenIds.has(id)) throw new Error(`스킬 ID가 중복됩니다. ${id}`);
    seenIds.add(id);
    required(sheet, ".sheet-in", `${index + 1}번째 스킬`);
    required(sheet, ".sheet-l", `${index + 1}번째 스킬`);
    required(sheet, ".sheet-r", `${index + 1}번째 스킬`);
    return parseSkill(row, sheet, index);
  });

  const titles = skills.map((skill) => skill.title);
  if (new Set(titles).size !== titles.length) throw new Error("스킬 제목이 중복됩니다.");
  const prompts = skills.map((skill, index) => ({
    title: `${String(index + 1).padStart(2, "0")}. ${skill.title} 설치·사용`,
    category: skill.category,
    summary: `${skill.title} 스킬의 설치·사용을 요청하는 프롬프트입니다.`,
    when_to_use: `${skill.title}을 설치하거나 사용할 때 클로드코드에 그대로 붙여넣으세요.`,
    pageTitle: skill.title,
    sourceUrl: skill.sourceUrl,
    install: skill.install,
  }));
  if (new Set(prompts.map((prompt) => prompt.title)).size !== prompts.length) {
    throw new Error("프롬프트 제목이 중복됩니다.");
  }
  for (const skill of skills) {
    if (skill.markdown.length < 300 || skill.content.length < 300) {
      throw new Error(`본문이 지나치게 짧습니다. ${skill.title}`);
    }
    if (!skill.install.trim() || !skill.markdown.includes(skill.install)) {
      throw new Error(`설치 프롬프트가 본문에 보존되지 않았습니다. ${skill.title}`);
    }
  }
  return { skills, prompts };
}

function stats(values) {
  const lengths = values.map((value) => value.length);
  return {
    min: Math.min(...lengths),
    max: Math.max(...lengths),
    average: Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length),
  };
}

// supabase-js의 .in()은 GET 쿼리스트링으로 전송되어 제목이 많으면 URL 길이 한계에 걸린다.
// 배치로 쪼개 조회한 뒤 결과를 하나로 합친다.
async function selectByTitles(client, table, select, titles, chunkSize = 20) {
  const rows = [];
  for (let i = 0; i < titles.length; i += chunkSize) {
    const chunk = titles.slice(i, i + chunkSize);
    const { data, error } = await client.from(table).select(select).eq("user_id", PROD_USER).in("title", chunk);
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

function makePromptSections(prompt, pageId) {
  if (!pageId) throw new Error(`관련 Page ID를 찾지 못했습니다. ${prompt.title}`);
  return JSON.stringify([
    { title: "설치 프롬프트", body: prompt.install },
    { title: "관련 Page", body: `/pages/${pageId}` },
    { title: "원본 링크", body: prompt.sourceUrl },
  ]);
}

const { skills, prompts } = await loadSkills();
if (isCheck) {
  console.log(JSON.stringify({
    pages: skills.length,
    prompts: prompts.length,
    titleLength: stats(skills.map((skill) => skill.title)),
    bodyLength: stats(skills.map((skill) => skill.markdown)),
    installLength: stats(prompts.map((prompt) => prompt.install)),
  }, null, 2));
  process.exit(0);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase 운영 환경변수가 없습니다.");
}

const now = new Date().toISOString();
const dbPath = resolve(root, "data/mymark.db");
if (!existsSync(dbPath)) {
  console.error("로컬 DB가 없습니다. data/mymark.db 파일을 준비한 뒤 다시 실행하세요.");
  process.exit(1);
}
const db = new Database(dbPath);
let localPages = 0;
let localPageUpdates = 0;
let localPrompts = 0;
let localPromptUpdates = 0;
const localPageIds = new Map();
try {
  const findPage = db.prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND title = ?");
  const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
  const updatePage = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
  const findPrompt = db.prepare("SELECT id, summary, when_to_use, sections FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
  const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
  const updatePrompt = db.prepare("UPDATE prompts SET summary = ?, when_to_use = ?, sections = ?, updated_at = ? WHERE id = ? AND user_id = ?");
  db.transaction(() => {
    for (const skill of skills) {
      const existing = findPage.get(LOCAL_USER, skill.title);
      const pageId = existing?.id ?? randomUUID();
      localPageIds.set(skill.title, pageId);
      if (!existing) {
        insertPage.run(pageId, LOCAL_USER, skill.title, skill.content, now, now);
        localPages += 1;
      } else if (existing.content !== skill.content) {
        updatePage.run(skill.content, now, existing.id, LOCAL_USER);
        localPageUpdates += 1;
      }
    }
    for (const prompt of prompts) {
      const promptSections = makePromptSections(prompt, localPageIds.get(prompt.pageTitle));
      const existing = findPrompt.get(LOCAL_USER, prompt.title, prompt.category);
      if (!existing) {
        insertPrompt.run(randomUUID(), LOCAL_USER, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, promptSections, now, now);
        localPrompts += 1;
      } else if (existing.summary !== prompt.summary || existing.when_to_use !== prompt.when_to_use || existing.sections !== promptSections) {
        updatePrompt.run(prompt.summary, prompt.when_to_use, promptSections, now, existing.id, LOCAL_USER);
        localPromptUpdates += 1;
      }
    }
  })();
} finally {
  db.close();
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const existingPages = await selectByTitles(supabase, "custom_pages", "id, title, content", skills.map((skill) => skill.title));
const pageMap = new Map(existingPages.map((page) => [page.title, page]));
const newPages = [];
const changedPages = [];
const prodPageIds = new Map();
for (const skill of skills) {
  const existing = pageMap.get(skill.title);
  const pageId = existing?.id ?? randomUUID();
  prodPageIds.set(skill.title, pageId);
  if (!existing) newPages.push({ id: pageId, user_id: PROD_USER, title: skill.title, content: skill.content, created_at: now, updated_at: now });
  else if (existing.content !== skill.content) changedPages.push({ id: existing.id, content: skill.content });
}
if (newPages.length) {
  const { error } = await supabase.from("custom_pages").insert(newPages);
  if (error) throw error;
}
for (const page of changedPages) {
  const { error } = await supabase.from("custom_pages").update({ content: page.content, updated_at: now }).eq("id", page.id).eq("user_id", PROD_USER);
  if (error) throw error;
}

const existingPrompts = await selectByTitles(supabase, "prompts", "id, title, category, summary, when_to_use, sections", prompts.map((prompt) => prompt.title));
const promptMap = new Map(existingPrompts.map((prompt) => [`${prompt.title}\n${prompt.category}`, prompt]));
const newPrompts = [];
const changedPrompts = [];
for (const prompt of prompts) {
  const existing = promptMap.get(`${prompt.title}\n${prompt.category}`);
  const row = { summary: prompt.summary, when_to_use: prompt.when_to_use, sections: makePromptSections(prompt, prodPageIds.get(prompt.pageTitle)) };
  if (!existing) newPrompts.push({ id: randomUUID(), user_id: PROD_USER, title: prompt.title, category: prompt.category, ...row, is_favorite: 0, created_at: now, updated_at: now });
  else if (existing.summary !== row.summary || existing.when_to_use !== row.when_to_use || existing.sections !== row.sections) changedPrompts.push({ id: existing.id, ...row });
}
if (newPrompts.length) {
  const { error } = await supabase.from("prompts").insert(newPrompts);
  if (error) throw error;
}
for (const prompt of changedPrompts) {
  const { id, ...row } = prompt;
  const { error } = await supabase.from("prompts").update({ ...row, updated_at: now }).eq("id", id).eq("user_id", PROD_USER);
  if (error) throw error;
}

console.log(JSON.stringify({
  parsedPages: skills.length,
  parsedPrompts: prompts.length,
  localPages,
  localPageUpdates,
  localPrompts,
  localPromptUpdates,
  prodPages: newPages.length,
  prodPageUpdates: changedPages.length,
  prodPrompts: newPrompts.length,
  prodPromptUpdates: changedPrompts.length,
}, null, 2));
