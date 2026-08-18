// 조회수 터지는 블로그 치트키 제목 400개 Notion 원문을 Pages와 Prompts에 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const sourceUrl = "https://halved-stretch-7af.notion.site/400-3bf9770df064809ebd67ec2047571b45";
const pageId = "3bf9770d-f064-809e-bd67-ec2047571b45";
const hex = pageId.replaceAll("-", "");
const expectedTitle = "조회수 터지는 블로그 치트키 제목 400개";
const category = "Notion · 조회수 터지는 블로그 치트키 제목 400개";
const endpoint = "https://www.notion.so/api/v3/loadPageChunk";
const signedFileEndpoint = "https://www.notion.so/api/v3/getSignedFileUrls";
const unsafeParts = ["file.notion.so", "expirationTimestamp", "X-Amz", "blob:"];
const now = new Date().toISOString();

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
const { extractPageMediaReferences, normalizedNotionWeekTitle } = require(
  resolve(root, "src/lib/page-attachment-storage.ts"),
);

const pause = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
let lastRequestAt = 0;

function plainText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((fragment) => {
    if (typeof fragment === "string") return fragment;
    if (!Array.isArray(fragment)) return "";
    return typeof fragment[0] === "string" ? fragment[0] : plainText(fragment);
  }).join("");
}

function inlineMarkdown(value) {
  if (!Array.isArray(value)) return plainText(value);
  return value.map((fragment) => {
    if (typeof fragment === "string") return fragment;
    if (!Array.isArray(fragment)) return "";
    let result = typeof fragment[0] === "string" ? fragment[0] : plainText(fragment);
    for (const mark of Array.isArray(fragment[1]) ? fragment[1] : []) {
      if (!Array.isArray(mark)) continue;
      if (mark[0] === "a" && mark[1]) result = `[${result}](${mark[1]})`;
      if (mark[0] === "b") result = `**${result}**`;
      if (mark[0] === "i") result = `*${result}*`;
      if (mark[0] === "c") result = `\`${result}\``;
      if (mark[0] === "s") result = `~~${result}~~`;
    }
    return result;
  }).join("");
}

function titleOf(block) {
  return inlineMarkdown(block?.properties?.title).trim();
}

function sourceOf(block) {
  return plainText(block?.properties?.source) || block?.format?.display_source || "";
}

function linkifyPlainUrls(text) {
  return text.replace(/(^|[\s:：])(https?:\/\/[^\s]+)/g, (match, prefix, url) => `${prefix}[${url}](${url})`);
}

async function requestJson(url, body) {
  const retryDelays = [15000, 30000, 60000];
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < 1000) await pause(1000 - elapsed);
    const response = await fetch(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
      body: JSON.stringify(body),
    });
    lastRequestAt = Date.now();
    if (response.ok) return response.json();
    if (![429, 503].includes(response.status) || attempt === retryDelays.length) {
      throw new Error(`Notion HTTP ${response.status}`);
    }
    await pause(retryDelays[attempt]);
  }
  throw new Error("Notion 요청 실패");
}

function ingestBlocks(chunk, blocks) {
  for (const [blockId, record] of Object.entries(chunk.recordMap?.block ?? {})) {
    const block = record?.value?.value ?? record?.value ?? null;
    if (block && !blocks.has(blockId)) blocks.set(blockId, block);
  }
}

async function loadSource() {
  const blocks = new Map();
  let cursor = { stack: [] };
  let chunkNumber = 0;
  do {
    const chunk = await requestJson(endpoint, {
      pageId,
      limit: 999999,
      cursor,
      chunkNumber,
      verticalColumns: false,
    });
    ingestBlocks(chunk, blocks);
    cursor = chunk.cursor ?? { stack: [] };
    chunkNumber += 1;
  } while (cursor.stack?.length);
  const page = blocks.get(pageId);
  if (!page) throw new Error("Notion 페이지를 찾지 못했습니다.");
  const liveTitle = titleOf(page) || expectedTitle;
  const queue = [];
  const queued = new Set();
  const scan = (id) => {
    const block = blocks.get(id);
    if (!block) {
      if (!queued.has(id) && queued.size < 80) {
        queued.add(id);
        queue.push(id);
      }
      return;
    }
    if (block.type === "page" && id !== pageId) return;
    if (block.type === "table_row") return;
    for (const childId of block.content ?? []) scan(childId);
  };
  scan(pageId);
  while (queue.length) {
    const id = queue.shift();
    const childChunk = await requestJson(endpoint, {
      pageId: id,
      limit: 999999,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    });
    ingestBlocks(childChunk, blocks);
    if (!blocks.has(id)) continue;
    scan(id);
  }
  return { page, blocks, liveTitle };
}

function imageMime(bytes, header) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/)) return "image/gif";
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 형식을 판별하지 못했습니다.");
}

async function responseDataUrl(response) {
  if (!response.ok) throw new Error(`미디어 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function mediaFor(item) {
  const media = new Map();
  const requests = [];
  for (const block of item.blocks.values()) {
    if (block.type !== "image") continue;
    const url = sourceOf(block);
    if (url.startsWith("data:image/")) media.set(block.id, url);
    else requests.push({ key: block.id, url, permissionRecord: { table: "block", id: block.id, spaceId: block.space_id } });
  }
  for (const request of requests.filter((entry) => entry.url.startsWith("attachment:"))) {
    const signed = await requestJson(signedFileEndpoint, {
      urls: [{ permissionRecord: request.permissionRecord, url: request.url }],
    });
    media.set(request.key, await responseDataUrl(await fetch(signed.signedUrls?.[0])));
  }
  for (const request of requests.filter((entry) => !entry.url.startsWith("attachment:"))) {
    const url = request.url.startsWith("/") ? `https://www.notion.so${request.url}` : request.url;
    media.set(request.key, await responseDataUrl(await fetch(url, {
      headers: { referer: "https://www.notion.so/", "user-agent": "Mozilla/5.0" },
    })));
  }
  return media;
}

function tableMarkdown(block, blocks) {
  const columns = block.format?.table_block_column_order ?? [];
  const rows = (block.content ?? [])
    .map((id) => blocks.get(id))
    .filter(Boolean)
    .map((row) => columns.map((column) => inlineMarkdown(row.properties?.[column]).replace(/\|/g, "\\|").replace(/\n/g, " ")));
  if (!rows.length) return "";
  return rows.map((row, index) => `| ${row.join(" | ")} |${index === 0 ? `\n| ${row.map(() => "---").join(" | ")} |` : ""}`).join("\n");
}

function documentFor(item, media) {
  const promptParts = [];
  let inPrompt = false;
  function render(id, path = new Set(), ancestors = []) {
    const block = item.blocks.get(id);
    if (!block || path.has(id)) return "";
    const nextPath = new Set(path).add(id);
    const title = titleOf(block);
    const rawTitle = plainText(block.properties?.title);
    const nextAncestors = title ? [...ancestors, title] : ancestors;
    if (rawTitle.includes("[프롬프트]") && !rawTitle.includes("사용법")) inPrompt = true;
    const firstChild = item.blocks.get((block.content ?? [])[0]);
    if (block.type === "callout" && /시니어 콘텐츠 전략가/.test(plainText(firstChild?.properties?.title))) {
      inPrompt = true;
    }
    if (rawTitle.includes("마케터C 관련 링크")) inPrompt = false;
    const children = (block.content ?? []).map((childId) => render(childId, nextPath, nextAncestors)).filter(Boolean).join("\n\n");
    if (rawTitle.includes("마케터C 관련 링크")) inPrompt = false;
    if (inPrompt && block.type !== "table" && title) {
      promptParts.push(block.type === "bulleted_list" ? `- ${plainText(block.properties?.title)}` : plainText(block.properties?.title));
    }
    if (block.type === "image") {
      return media.get(block.id) ? `![${title || "Notion 이미지"}](${media.get(block.id)})` : "";
    }
    if (block.type === "table") {
      const table = tableMarkdown(block, item.blocks);
      if (inPrompt && table) promptParts.push(table);
      return table;
    }
    if (block.type === "table_row") return "";
    if (block.type === "divider") return "---";
    if (block.type === "callout") return `:::callout\n${[title, children].filter(Boolean).join("\n\n")}\n:::`;
    if (block.type === "quote") return `> ${title}${children ? `\n${children}` : ""}`;
    if (block.type === "bulleted_list") return [`- ${title}`, children].filter(Boolean).join("\n");
    if (block.type === "numbered_list") return [`1. ${title}`, children].filter(Boolean).join("\n");
    if (block.type === "header" || block.type === "header_1") return [`# ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "header_4") return [`#### ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "sub_header" || block.type === "header_2") return [`## ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "sub_sub_header" || block.type === "header_3") return [`### ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "table_of_contents") return "";
    return [title ? linkifyPlainUrls(title) : "", children].filter(Boolean).join("\n\n");
  }
  const body = (item.page.content ?? []).map((id) => render(id)).filter(Boolean).join("\n\n");
  const markdown = [`# ${item.liveTitle}`, `> 원문. [Notion](${sourceUrl})`, body].filter(Boolean).join("\n\n");
  const promptBody = promptParts.map((line) => line.trim()).filter(Boolean).join("\n\n");
  return {
    title: item.liveTitle,
    content: JSON.stringify(markdownToTiptapDoc(markdown)),
    markdown,
    promptBody,
  };
}

function isSamePage(rows, title) {
  const normalized = normalizedNotionWeekTitle(title);
  return rows.some((row) => (
    normalizedNotionWeekTitle(row.title) === normalized
    || (row.content != null && String(row.content).includes(hex))
    || (row.content != null && String(row.content).includes(sourceUrl))
  ));
}

const item = await loadSource();
const media = await mediaFor(item);
const document = documentFor(item, media);
const mediaRefs = extractPageMediaReferences(document.content);
if (!document.content.includes(sourceUrl)) throw new Error("원문 주소가 없습니다.");
if (unsafeParts.some((part) => document.content.includes(part))) throw new Error("만료 URL이 남아 있습니다.");
if (mediaRefs.imageSources.some((src) => !src.startsWith("data:image/"))) throw new Error("이미지가 data URL이 아닙니다.");
if (mediaRefs.imageSources.length !== 3) throw new Error(`이미지 수가 3개가 아닙니다. ${mediaRefs.imageSources.length}`);
if (!/시니어 콘텐츠 전략가|블로그 제목 400개/.test(document.promptBody)) {
  throw new Error(`프롬프트 본문이 비어 있습니다. ${document.promptBody.slice(0, 200)}`);
}

const prompt = {
  title: "블로그 치트키 제목 400개 만들기",
  category,
  summary: "내 정보만 바꿔 넣으면 타겟 검색 심리 기반 블로그 제목 400개를 표로 만듭니다.",
  when_to_use: "한 달치 블로그 글감과 롱테일 제목이 필요할 때 사용하세요.",
  sections: JSON.stringify([
    { title: "프롬프트", body: document.promptBody },
    { title: "관련 Page", body: document.title },
    { title: "원문 Notion", body: sourceUrl },
  ]),
};

if (process.argv.includes("--check")) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  console.log(JSON.stringify({
    writes: 0,
    title: document.title,
    images: mediaRefs.imageSources.length,
    promptChars: document.promptBody.length,
    localPage: isSamePage(pages, document.title) ? "skip" : "insert",
  }, null, 2));
  process.exit(0);
}

function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { page: "skipped", prompt: "skipped" };
  const transaction = db.transaction(() => {
    const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    if (!isSamePage(pages, document.title)) {
      db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), localUser, document.title, document.content, now, now);
      result.page = "inserted";
    }
    const existing = db.prepare("SELECT title, category, sections FROM prompts WHERE user_id = ? AND title = ? AND category = ?")
      .get(localUser, prompt.title, prompt.category);
    if (!existing) {
      db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
        .run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now);
      result.prompt = "inserted";
    }
  });
  transaction();
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
  const result = { page: "skipped", prompt: "skipped" };
  const { data: pages, error: pageError } = await supabase.from("custom_pages").select("id, title").eq("user_id", productionUser);
  if (pageError) throw pageError;
  if (!isSamePage(pages ?? [], document.title)) {
    const { error } = await supabase.from("custom_pages").insert({
      id: randomUUID(),
      user_id: productionUser,
      title: document.title,
      content: document.content,
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
    result.page = "inserted";
  }
  const { data: prompts, error: promptError } = await supabase
    .from("prompts")
    .select("id")
    .eq("user_id", productionUser)
    .eq("title", prompt.title)
    .eq("category", prompt.category)
    .limit(1);
  if (promptError) throw promptError;
  if (!prompts?.length) {
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
    result.prompt = "inserted";
  }
  return result;
}

const local = importLocal();
const production = await importProduction();
console.log(JSON.stringify({
  title: document.title,
  images: mediaRefs.imageSources.length,
  promptChars: document.promptBody.length,
  local,
  production,
}, null, 2));
