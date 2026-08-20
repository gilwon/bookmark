// 한국 시간 2026-08-17 이후 Notion 페이지를 Pages·Prompts에 저장한다
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotDir = resolve(root, "tmp/notion-kst-after-20260817");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const checkOnly = process.argv.includes("--check");
const unsafeParts = ["prod-files-secure", "file.notion.so", "expirationTimestamp", "X-Amz", "blob:", "Security-Token"];
const skipPromptStart = /^(npm |pnpm |yarn |npx |pip |python |curl |git |sudo |irm |claude remote-control|\/plugin )/i;
const materialNames = ["젤리", "니트", "진주", "풍선", "크리스탈", "종이", "퍼", "패브릭", "모자이크"];
const expectedTitles = {
  "0b0b256827ac830bad78016540bff1f7": "Gmail Dashboard 프롬프트",
  "0f8b256827ac83a78fe301bbdc3e0025": "[피그마스터] Design.md 뽀개기",
  "3dab256827ac82d8af8a0159e5f4a3ba": "재질 표현 프롬프트 @solrr.aa",
  "e27b256827ac820186ae01d2214973d6": "[trenddalkak] SpaceXAI 스택 활용법 · Origin 마이그레이션 체크리스트 · CLI 치트시트",
  "843b256827ac822e921801184aae95d5": "침대에서 클로드 코딩하기 · 원격 설정 가이드",
  "4eeb256827ac83e3a56801fe27b7b862": "시장조사부터 마케팅 캠페인 제작 올인원 플랫폼",
  "57db256827ac82eaa5858154dbc2e529": "구글 엔지니어의 코딩 스킬 24개 — 전체 정리 + 사용 순서 (EP.35 DM 리소스)",
  "38eb256827ac83d8b6dd01fa687092f4": "클로드를 펀드매니저로 만들기",
  "b91b256827ac82fe92db81a6165df6e3": "클로드코드 스태터스 라인 세팅 스크립트 @대학원생 클로이",
};
const expectedImages = {
  "0b0b256827ac830bad78016540bff1f7": 2,
  "0f8b256827ac83a78fe301bbdc3e0025": 5,
  "3dab256827ac82d8af8a0159e5f4a3ba": 2,
  "e27b256827ac820186ae01d2214973d6": 3,
  "843b256827ac822e921801184aae95d5": 1,
  "4eeb256827ac83e3a56801fe27b7b862": 0,
  "57db256827ac82eaa5858154dbc2e529": 0,
  "38eb256827ac83d8b6dd01fa687092f4": 0,
  "b91b256827ac82fe92db81a6165df6e3": 0,
};

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(['"])|(['"])$/g, "");
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
const { normalizePasteToMarkdown } = require(resolve(root, "src/lib/normalize-to-markdown.ts"));
const { extractPageMediaReferences, normalizedNotionWeekTitle } = require(
  resolve(root, "src/lib/page-attachment-storage.ts"),
);

const pages = JSON.parse(readFileSync(resolve(snapshotDir, "pages-raw.json"), "utf8"));
const imageMap = JSON.parse(readFileSync(resolve(snapshotDir, "images.json"), "utf8"));

function mimeOf(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/)) return "image/gif";
  if (Buffer.from(bytes.subarray(0, 12)).toString("ascii").match(/^RIFF....WEBP$/)) return "image/webp";
  throw new Error("이미지 MIME을 판별하지 못했습니다.");
}

function dataUrlFor(filename) {
  const bytes = readFileSync(resolve(snapshotDir, "images", filename));
  return `data:${mimeOf(bytes)};base64,${bytes.toString("base64")}`;
}

const dataUrls = new Map(imageMap.map((item) => [item.key.split("/").at(-2), dataUrlFor(item.path)]));

function extractNotionContent(value) {
  return String(value).match(/<content>\n([\s\S]*?)\n<\/content>/)?.[1]?.trim() ?? String(value).trim();
}

function cleanTableCell(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\|/g, "\\|");
}

function convertTables(value) {
  return value.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_table, body) => {
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cleanTableCell(cell[1])),
    );
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
    return `\n${normalized.flatMap((row, index) => [
      `| ${row.join(" | ")} |`,
      ...(index === 0 ? [`| ${row.map(() => "---").join(" | ")} |`] : []),
    ]).join("\n")}\n`;
  });
}

function imageDataUrl(url) {
  const uuid = url.split("/")[4];
  const dataUrl = dataUrls.get(uuid);
  if (!dataUrl) throw new Error(`이미지 파일을 찾지 못했습니다. ${uuid}`);
  return dataUrl;
}

function replaceImages(markdown) {
  let value = markdown.replace(
    /!\[\[([^\]]+)\]\((https?:[^)]+)\)\]\((https:\/\/prod-files-secure\.s3[^)]+)\)/g,
    (_match, label, _link, url) => `![${label}](${imageDataUrl(url)})`,
  );
  value = value.replace(/!\[[^\]]*\]\((https:\/\/prod-files-secure\.s3[^)]+)\)/g, (match, url) => {
    const alt = match.match(/^!\[([^\]]*)\]/)?.[1] || "Notion 이미지";
    return `![${alt}](${imageDataUrl(url)})`;
  });
  return value;
}

function hoistCalloutImages(markdown) {
  return markdown.replace(/:::callout\n([\s\S]*?)\n:::/g, (_full, body) => {
    const images = [...body.matchAll(/!\[[^\]]*\]\([^)]+\)/g)].map((match) => match[0]);
    const without = body.replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
    return `:::callout\n${without}\n:::\n\n${images.join("\n\n")}`;
  });
}

function normalizePageMarkdown(page) {
  let content = extractNotionContent(page.text);
  content = convertTables(content);
  content = content.replace(/<callout[^>]*>\n?([\s\S]*?)\n?<\/callout>/gi, (_callout, body) =>
    `\n\n:::callout\n${body.replace(/<br\s*\/?>/gi, "\n").replace(/^\t/gm, "").trim()}\n:::\n\n`,
  );
  content = content
    .replace(/<unknown\s+([^>]*?)\s*\/?>/gi, (_tag, attrs) => {
      const url = attrs.match(/\burl="([^"]+)"/)?.[1] ?? "";
      const alt = attrs.match(/\balt="([^"]+)"/)?.[1] ?? "링크";
      return url ? `[${alt}](${url})` : "";
    })
    .replace(/<\/?(?:columns|column|empty-block|table_of_contents)[^>]*\/?>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?span[^>]*>/gi, "")
    .replace(/^\t+/gm, "")
    .replace(/\\~/g, "~")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  content = replaceImages(content);
  content = hoistCalloutImages(content);
  content = content.replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n");
  const title = expectedTitles[page.hex];
  return [`# ${title}`, `> 원문. [Notion](${page.url})`, content].filter(Boolean).join("\n\n");
}

function restoreProtected(node) {
  if (typeof node.text === "string") {
    node.text = node.text.replace(/%%NOTION_LT%%/g, "<").replace(/%%NOTION_GT%%/g, ">");
  }
  for (const child of node.content ?? []) restoreProtected(child);
}

function countNodes(content, type) {
  let count = 0;
  function visit(node) {
    if (node?.type === type) count += 1;
    for (const child of node?.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return count;
}

function materialPrompts(markdown) {
  const prompts = [];
  for (const name of materialNames) {
    const match = markdown.match(new RegExp(`\\*\\*${name}\\*\\*\\s*\\n([a-z][\\s\\S]*?)(?=\\n\\s*\\d+\\.\\s*\\*\\*|$)`, "i"));
    if (!match) continue;
    const body = match[1].replace(/<[^>]+>/g, "").trim();
    if (body.length >= 40) prompts.push({ name, body });
  }
  return prompts;
}

function promptBodies(markdown, page) {
  const bodies = [];
  for (const match of markdown.matchAll(/```([^\n]*)\n([\s\S]*?)\n```/g)) {
    const language = match[1].trim().toLowerCase();
    const body = match[2].trim();
    if (language === "mermaid") continue;
    if (body.length < 80) continue;
    if (skipPromptStart.test(body)) continue;
    bodies.push(body);
  }
  if (page.hex === "3dab256827ac82d8af8a0159e5f4a3ba") {
    for (const item of materialPrompts(markdown)) bodies.push(item.body);
  }
  return [...new Set(bodies)];
}

function promptsFor(page, markdown) {
  const title = expectedTitles[page.hex];
  const category = `Notion · ${title}`;
  const materials = page.hex === "3dab256827ac82d8af8a0159e5f4a3ba" ? materialPrompts(markdown) : [];
  return promptBodies(markdown, page).map((body, index) => {
    const material = materials.find((item) => item.body === body);
    return {
      title: material ? `재질 표현 · ${material.name}` : `${title} · 프롬프트 ${String(index + 1).padStart(2, "0")}`,
      category,
      summary: `${title}에서 복사해 재사용하는 프롬프트입니다.`,
      when_to_use: "원문 가이드의 해당 작업을 AI에게 요청할 때 사용하세요.",
      sections: JSON.stringify([
        { title: "프롬프트", body },
        { title: "관련 Page", body: title },
        { title: "원문 Notion", body: page.url },
      ]),
    };
  });
}

function duplicatePage(rows, page) {
  const title = expectedTitles[page.hex];
  const normalized = normalizedNotionWeekTitle(title);
  return rows.some((row) => (
    normalizedNotionWeekTitle(row.title) === normalized
    || String(row.content ?? "").includes(page.hex)
    || String(row.content ?? "").includes(page.url)
  ));
}

function samePrompt(rows, prompt) {
  return rows.some((row) => row.title === prompt.title && row.category === prompt.category);
}

function buildRecord(page) {
  const title = expectedTitles[page.hex];
  const protectedMarkdown = normalizePageMarkdown(page).replace(
    /```([^\n]*)\n([\s\S]*?)\n```/g,
    (_block, language, body) => `\`\`\`${language}\n${body.replace(/</g, "%%NOTION_LT%%").replace(/>/g, "%%NOTION_GT%%")}\n\`\`\``,
  );
  const markdown = normalizePasteToMarkdown(protectedMarkdown);
  const doc = markdownToTiptapDoc(markdown);
  restoreProtected(doc);
  const content = JSON.stringify(doc);
  const media = extractPageMediaReferences(content);
  const images = countNodes(content, "image");
  if (!content.includes(page.url)) throw new Error(`원문 주소가 없습니다. ${title}`);
  if (unsafeParts.some((part) => content.includes(part))) throw new Error(`만료 URL이 남아 있습니다. ${title}`);
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error(`이미지가 data URL이 아닙니다. ${title}`);
  }
  if (images !== expectedImages[page.hex] || media.imageSources.length !== expectedImages[page.hex]) {
    throw new Error(`이미지 수가 다릅니다. ${title} ${images}/${expectedImages[page.hex]}`);
  }
  const prompts = promptsFor(page, markdown);
  return { page, title, content, markdown, images, prompts };
}

const records = pages.map(buildRecord);

if (checkOnly) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const localPages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  console.log(JSON.stringify({
    writes: 0,
    pages: records.map((record) => ({
      title: record.title,
      images: record.images,
      prompts: record.prompts.length,
      skip: duplicatePage(localPages, record.page),
    })),
  }, null, 2));
  process.exit(0);
}

function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pagesInserted: 0, pagesSkipped: 0, promptsInserted: 0, promptsSkipped: 0 };
  db.transaction(() => {
    const pagesRows = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    const promptRows = db.prepare("SELECT title, category FROM prompts WHERE user_id = ?").all(localUser);
    const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
    for (const record of records) {
      if (duplicatePage(pagesRows, record.page)) result.pagesSkipped += 1;
      else {
        const now = new Date().toISOString();
        insertPage.run(randomUUID(), localUser, record.title, record.content, now, now);
        pagesRows.push({ title: record.title, content: record.content });
        result.pagesInserted += 1;
      }
      for (const prompt of record.prompts) {
        if (samePrompt(promptRows, prompt)) result.promptsSkipped += 1;
        else {
          const now = new Date().toISOString();
          insertPrompt.run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now);
          promptRows.push(prompt);
          result.promptsInserted += 1;
        }
      }
    }
  })();
  db.close();
  return result;
}

async function importProduction() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const result = { pagesInserted: 0, pagesSkipped: 0, promptsInserted: 0, promptsSkipped: 0 };
  for (const record of records) {
    const { data: pagesRows, error: pageError } = await supabase
      .from("custom_pages")
      .select("id, title")
      .eq("user_id", productionUser)
      .eq("title", record.title);
    if (pageError) throw pageError;
    if (duplicatePage(pagesRows ?? [], record.page)) result.pagesSkipped += 1;
    else {
      const now = new Date().toISOString();
      const { error } = await supabase.from("custom_pages").insert({
        id: randomUUID(),
        user_id: productionUser,
        title: record.title,
        content: record.content,
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;
      result.pagesInserted += 1;
    }
    for (const prompt of record.prompts) {
      const { data: promptRows, error: promptError } = await supabase
        .from("prompts")
        .select("id, title, category")
        .eq("user_id", productionUser)
        .eq("title", prompt.title)
        .eq("category", prompt.category)
        .limit(1);
      if (promptError) throw promptError;
      if (promptRows?.length) result.promptsSkipped += 1;
      else {
        const now = new Date().toISOString();
        const { error } = await supabase.from("prompts").insert({
          id: randomUUID(),
          user_id: productionUser,
          title: prompt.title,
          category: prompt.category,
          summary: prompt.summary,
          when_to_use: prompt.when_to_use,
          sections: prompt.sections,
          is_favorite: 0,
          created_at: now,
          updated_at: now,
        });
        if (error) throw error;
        result.promptsInserted += 1;
      }
    }
  }
  return result;
}

const local = importLocal();
const production = await importProduction();
console.log(JSON.stringify({
  pages: records.map((record) => ({ title: record.title, images: record.images, prompts: record.prompts.length })),
  local,
  production,
}, null, 2));
