// 캐릭터로 만드는 30초 AI 요리 릴스 범용 프롬프트를 Pages와 Prompts에 저장한다
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
const sourceUrl = "https://pineapple-pyroraptor-9c5.notion.site/30-AI-3bf72839155881f38eafd425391cdacf";
const pageId = "3bf72839-1558-81f3-8eaf-d425391cdacf";
const hex = pageId.replaceAll("-", "");
const spaceId = "7c635c9c-3423-44a0-b1fa-fd83159c1ae0";
const expectedTitle = "캐릭터로 만드는 30초 AI 요리 릴스 범용 프롬프트";
const category = "Notion · 캐릭터로 만드는 30초 AI 요리 릴스 범용 프롬프트";
const kakaoUrl = "https://open.kakao.com/o/gW18PoEf";
const endpoint = "https://www.notion.so/api/v3/loadPageChunk";
const signedFileEndpoint = "https://www.notion.so/api/v3/getSignedFileUrls";
const unsafeParts = ["file.notion.so", "expirationTimestamp", "X-Amz", "blob:", "prod-files-secure"];
const now = new Date().toISOString();
const checkOnly = process.argv.includes("--check");
const refresh = process.argv.includes("--refresh");

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

function fileNameOf(block) {
  const titled = plainText(block?.properties?.title).trim();
  if (titled) return titled;
  const source = sourceOf(block);
  if (source.startsWith("attachment:")) {
    const name = source.split(":").at(-1)?.trim();
    if (name) return name;
  }
  return "";
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
    if (block?.type && !blocks.has(blockId)) blocks.set(blockId, block);
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
  if (Buffer.from(bytes.subarray(0, 12)).toString("ascii").match(/^RIFF....WEBP$/)) return "image/webp";
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 형식을 판별하지 못했습니다.");
}

function isZipBytes(bytes, filename) {
  if (/\.zip$/i.test(filename)) return true;
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

function fileMime(bytes, header, filename) {
  try {
    return imageMime(bytes, header);
  } catch {
    if (header?.startsWith("image/")) return header.split(";")[0];
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (header && header !== "application/octet-stream") return header.split(";")[0];
  if (/\.pdf$/i.test(filename)) return "application/pdf";
  return "application/octet-stream";
}

async function responseBytes(response) {
  if (!response.ok) throw new Error(`미디어 HTTP ${response.status}`);
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    header: response.headers.get("content-type"),
  };
}

async function responseDataUrl(response) {
  const { bytes, header } = await responseBytes(response);
  return `data:${imageMime(bytes, header)};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function signedUrlFor(block, url) {
  const signed = await requestJson(signedFileEndpoint, {
    urls: [{
      permissionRecord: { table: "block", id: block.id, spaceId: block.space_id || spaceId },
      url,
    }],
  });
  const signedUrl = signed.signedUrls?.[0];
  if (!signedUrl) throw new Error(`서명 URL을 받지 못했습니다. ${block.id}`);
  return signedUrl;
}

async function fetchMedia(url, block) {
  if (url.startsWith("attachment:")) {
    return fetch(await signedUrlFor(block, url));
  }
  const absolute = url.startsWith("/") ? `https://www.notion.so${url}` : url;
  return fetch(absolute, {
    headers: { referer: "https://www.notion.so/", "user-agent": "Mozilla/5.0" },
  });
}

async function mediaFor(item) {
  const media = new Map();
  const requests = [];
  for (const block of item.blocks.values()) {
    if (block.type !== "image") continue;
    const url = sourceOf(block);
    if (url.startsWith("data:image/")) media.set(block.id, url);
    else requests.push({ key: block.id, url, block });
  }
  const cover = item.page.format?.page_cover;
  if (cover) {
    requests.push({
      key: `${pageId}:cover`,
      url: cover,
      block: item.page,
    });
  }
  for (const request of requests) {
    if (request.url.startsWith("data:image/")) {
      media.set(request.key, request.url);
      continue;
    }
    media.set(request.key, await responseDataUrl(await fetchMedia(request.url, request.block)));
  }
  return media;
}

async function attachmentsFor(item) {
  const files = new Map();
  const blocks = [...item.blocks.values()].filter((block) => block.type === "file" || block.type === "pdf");
  for (const block of blocks) {
    const filename = fileNameOf(block) || "첨부 파일";
    const url = sourceOf(block);
    if (!url) throw new Error(`첨부 URL이 없습니다. ${block.id}`);
    if (url.startsWith("data:")) {
      if (unsafeParts.some((part) => url.includes(part))) {
        throw new Error(`만료 URL 첨부를 저장할 수 없습니다. ${filename}`);
      }
      files.set(block.id, { filename, markdown: `[${filename}](${url})` });
      continue;
    }
    const { bytes, header } = await responseBytes(await fetchMedia(url, block));
    if (isZipBytes(bytes, filename)) {
      // ZIP은 허용 목록 없이는 저장하지 않고, 조용히 버리지 않는다.
      throw new Error("ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다.");
    }
    const mime = fileMime(bytes, header, filename);
    const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    if (unsafeParts.some((part) => dataUrl.includes(part))) {
      throw new Error(`만료 URL이 첨부 데이터에 남아 있습니다. ${filename}`);
    }
    files.set(block.id, { filename, markdown: `[${filename}](${dataUrl})` });
  }
  return files;
}

function isListMarkdown(value) {
  const line = String(value).split("\n")[0] ?? "";
  return /^(-\s|\d+\.\s)/.test(line);
}

function joinRendered(parts) {
  // 연속 목록은 빈 줄 없이 붙여 하나의 ordered/bullet 목록이 되게 한다.
  const joined = [];
  for (const part of parts) {
    const previous = joined.at(-1);
    if (previous && isListMarkdown(previous.split("\n").at(-1)) && isListMarkdown(part)) {
      joined[joined.length - 1] = `${previous}\n${part}`;
    } else {
      joined.push(part);
    }
  }
  return joined.join("\n\n");
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

function liveMediaCounts(item) {
  let images = 0;
  let attachments = 0;
  for (const block of item.blocks.values()) {
    if (block.type === "image") images += 1;
    if (block.type === "file" || block.type === "pdf") attachments += 1;
  }
  const hasCover = Boolean(item.page.format?.page_cover);
  return { images, attachments, hasCover, expectedImages: images + (hasCover ? 1 : 0) };
}

function documentFor(item, media, files) {
  const codeBlocks = [];
  const renderedMedia = new Set();
  function render(id, path = new Set()) {
    const block = item.blocks.get(id);
    if (!block || path.has(id)) return "";
    const nextPath = new Set(path).add(id);
    const title = titleOf(block);
    const children = joinRendered((block.content ?? []).map((childId) => render(childId, nextPath)).filter(Boolean));
    if (block.type === "image") {
      const src = media.get(block.id);
      if (!src) throw new Error(`이미지를 변환하지 못했습니다. ${block.id}`);
      renderedMedia.add(block.id);
      return `![${title || "Notion 이미지"}](${src})`;
    }
    if (block.type === "file" || block.type === "pdf") {
      const file = files.get(block.id);
      if (!file) throw new Error(`첨부 파일을 찾지 못했습니다. ${block.id}`);
      renderedMedia.add(block.id);
      return file.markdown;
    }
    if (block.type === "code") {
      const body = plainText(block.properties?.title);
      if (body.trim()) codeBlocks.push(body);
      const language = plainText(block.properties?.language) || block.format?.code_language || "text";
      return `\`\`\`${language}\n${body}\n\`\`\``;
    }
    if (block.type === "table") return tableMarkdown(block, item.blocks);
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
    if (block.type === "table_of_contents" || block.type === "copy_indicator") return "";
    if (block.type === "column_list" || block.type === "column" || block.type === "transclusion_container") return children;
    return [title ? linkifyPlainUrls(title) : "", children].filter(Boolean).join("\n\n");
  }
  const cover = media.get(`${pageId}:cover`);
  const body = joinRendered((item.page.content ?? []).map((id) => render(id)).filter(Boolean));
  for (const block of item.blocks.values()) {
    if ((block.type === "image" || block.type === "file" || block.type === "pdf") && !renderedMedia.has(block.id)) {
      throw new Error(`미디어 블록이 본문에 없습니다. ${block.id}`);
    }
  }
  const markdown = [`# ${item.liveTitle}`, `> 원문. [Notion](${sourceUrl})`, cover ? `![Notion 커버](${cover})` : "", body]
    .filter(Boolean)
    .join("\n\n")
    // 이미지가 문단 안에 섞이면 TipTap 이미지 노드가 되지 않는다.
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n");
  return {
    title: item.liveTitle,
    content: JSON.stringify(markdownToTiptapDoc(markdown)),
    markdown,
    codeBlocks,
    promptBody: codeBlocks[0] ?? "",
  };
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

function isSamePage(rows, title) {
  const normalized = normalizedNotionWeekTitle(title);
  return rows.some((row) => (
    normalizedNotionWeekTitle(row.title) === normalized
    || (row.content != null && String(row.content).includes(hex))
    || (row.content != null && String(row.content).includes(sourceUrl))
  ));
}

function assertIntegrity(document, live, files) {
  const mediaRefs = extractPageMediaReferences(document.content);
  if (!document.content.includes(sourceUrl)) throw new Error("원문 주소가 없습니다.");
  const parsed = JSON.parse(document.content);
  const heading = parsed.content?.find((node) => node.type === "heading");
  const headingText = (heading?.content ?? []).map((node) => node.text ?? "").join("");
  if (!heading || headingText !== document.title) throw new Error("제목 헤딩이 없습니다.");
  if (unsafeParts.some((part) => document.content.includes(part))) throw new Error("만료 URL이 남아 있습니다.");
  if (mediaRefs.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  const imageNodes = countNodes(document.content, "image");
  if (imageNodes !== live.expectedImages || mediaRefs.imageSources.length !== live.expectedImages) {
    throw new Error(`이미지 수가 라이브와 다릅니다. ${imageNodes}/${live.expectedImages}`);
  }
  if (files.size !== live.attachments) {
    throw new Error(`첨부 수가 라이브와 다릅니다. ${files.size}/${live.attachments}`);
  }
  for (const file of files.values()) {
    if (!document.markdown.includes(file.markdown)) {
      throw new Error(`첨부가 본문에 없습니다. ${file.filename}`);
    }
  }
  const fenced = document.markdown.match(/^```[^\n]*\n[\s\S]*?^```/gm) ?? [];
  if (fenced.length !== 3 || document.codeBlocks.length !== 3 || countNodes(document.content, "codeBlock") !== 3) {
    throw new Error(`코드 블록이 3개가 아닙니다. ${fenced.length}/${document.codeBlocks.length}`);
  }
  if (!mediaRefs.linkHrefs.includes(kakaoUrl)) throw new Error("카카오 링크 마크가 없습니다.");
  if (!document.promptBody.trim() || !document.promptBody.startsWith("Create one continuous 30-second")) {
    throw new Error(`프롬프트 본문이 비어 있습니다. ${document.promptBody.slice(0, 200)}`);
  }
  const orderedSizes = parsed.content.filter((node) => node.type === "orderedList").map((node) => node.content?.length ?? 0);
  const bulletSizes = parsed.content.filter((node) => node.type === "bulletList").map((node) => node.content?.length ?? 0);
  if (JSON.stringify(orderedSizes) !== JSON.stringify([3]) || JSON.stringify(bulletSizes) !== JSON.stringify([5])) {
    throw new Error(`목록이 이어지지 않았습니다. ordered=${JSON.stringify(orderedSizes)} bullets=${JSON.stringify(bulletSizes)}`);
  }
}

const item = await loadSource();
const live = liveMediaCounts(item);
const media = await mediaFor(item);
const files = await attachmentsFor(item);
const document = documentFor(item, media, files);
assertIntegrity(document, live, files);
const mediaRefs = extractPageMediaReferences(document.content);

const prompt = {
  title: expectedTitle,
  category,
  summary: "캐릭터 이미지를 첨부하고 요리명만 바꿔 30초 세로 요리 릴스를 만드는 범용 프롬프트입니다.",
  when_to_use: "고정 캐릭터로 30초 요리 릴스를 만들 때 사용하세요.",
  sections: JSON.stringify([
    { title: "프롬프트", body: document.promptBody },
    { title: "관련 Page", body: document.title },
    { title: "원문 Notion", body: sourceUrl },
  ]),
};

if (checkOnly) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  console.log(JSON.stringify({
    writes: 0,
    title: document.title,
    images: live.images,
    attachments: live.attachments,
    promptChars: document.promptBody.length,
    localPage: isSamePage(pages, document.title) ? "skip" : "insert",
  }, null, 2));
  process.exit(0);
}

function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { page: "skipped", prompt: "skipped" };
  const transaction = db.transaction(() => {
    const pages = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    if (!isSamePage(pages, document.title)) {
      db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), localUser, document.title, document.content, now, now);
      result.page = "inserted";
    } else if (refresh) {
      const row = pages.find((page) => normalizedNotionWeekTitle(page.title) === normalizedNotionWeekTitle(document.title));
      if (!row) throw new Error("갱신할 로컬 Page를 찾지 못했습니다.");
      db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
        .run(document.content, now, row.id, localUser);
      result.page = "updated";
    }
    const existing = db.prepare("SELECT id, title, category FROM prompts WHERE user_id = ? AND title = ? AND category = ?")
      .get(localUser, prompt.title, prompt.category);
    if (!existing) {
      db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
        .run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now);
      result.prompt = "inserted";
    } else if (refresh) {
      db.prepare("UPDATE prompts SET summary = ?, when_to_use = ?, sections = ?, updated_at = ? WHERE id = ? AND user_id = ?")
        .run(prompt.summary, prompt.when_to_use, prompt.sections, now, existing.id, localUser);
      result.prompt = "updated";
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
  const { data: pages, error: pageError } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", productionUser)
    .eq("title", document.title);
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
  } else if (refresh) {
    const row = pages.find((page) => normalizedNotionWeekTitle(page.title) === normalizedNotionWeekTitle(document.title));
    if (!row) throw new Error("갱신할 운영 Page를 찾지 못했습니다.");
    const { error } = await supabase.from("custom_pages").update({
      content: document.content,
      updated_at: now,
    }).eq("id", row.id).eq("user_id", productionUser);
    if (error) throw error;
    result.page = "updated";
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
  } else if (refresh) {
    const { error } = await supabase.from("prompts").update({
      summary: prompt.summary,
      when_to_use: prompt.when_to_use,
      sections: prompt.sections,
      updated_at: now,
    }).eq("id", prompts[0].id).eq("user_id", productionUser);
    if (error) throw error;
    result.prompt = "updated";
  }
  return result;
}

const local = importLocal();
const production = await importProduction();
console.log(JSON.stringify({
  title: document.title,
  images: live.images,
  attachments: live.attachments,
  promptChars: document.promptBody.length,
  storedImages: mediaRefs.imageSources.length,
  local,
  production,
}, null, 2));
