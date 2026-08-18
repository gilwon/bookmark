// 네이버 사이트 퍼널 공개 Notion 26건을 Pages와 Prompts에 중복 없이 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = "https://www.notion.so/api/v3/loadPageChunk";
const signedFileEndpoint = "https://www.notion.so/api/v3/getSignedFileUrls";
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const checkOnly = process.argv.includes("--check");
const unsafeParts = ["file.notion.so", "expirationTimestamp", "X-Amz", "blob:"];

const sources = [
  ["3a755393-f0f3-8128-81df-e4ada2602e01", "https://surf-push-7ae.notion.site/30-3a755393f0f3812881dfe4ada2602e01", "고객이 매일 쌓이는 자동화 구조 만드는 클로드 프롬프트 30개", "", true],
  ["3a855393-f0f3-8156-9ea9-c41d643fcbc4", "https://surf-push-7ae.notion.site/100-1-3a855393f0f381569ea9c41d643fcbc4", "월 100만 원에서 월 1억까지 가는 수익 구간별 프롬프트", "", true],
  ["3a955393-f0f3-812c-9bae-f964cc41664a", "https://surf-push-7ae.notion.site/5-AI-20-3a955393f0f3812c9baef964cc41664a", "지금 당장 매출을 5배 높이는 AI 프롬프트 20가지", "", true],
  ["3aa55393-f0f3-81c4-9c7e-fe66ab38bc21", "https://surf-push-7ae.notion.site/1-3aa55393f0f381c49c7efe66ab38bc21", "클릭 딱 1번으로 경쟁사 광고 구조 복제하는 법", "", true],
  ["3ab55393-f0f3-8112-9201-ff57b89a5be2", "https://surf-push-7ae.notion.site/AI-GPT-3ab55393f0f381129201ff57b89a5be2", "내 경험을 상품으로 만드는 AI 퍼널 실전 가이드 (챗GPT × 퍼플렉시티 × 클로드)", "", true],
  ["3ac55393-f0f3-81a5-b774-e3e33e0c0866", "https://surf-push-7ae.notion.site/3ac55393f0f381a5b774e3e33e0c0866", "내 경험을 돈이 되는 상품으로 바꾸는 수익화 아이템 발굴 프롬프트", "", true],
  ["3ac55393-f0f3-8145-ad0c-c882279f3cde", "https://surf-push-7ae.notion.site/3ac55393f0f38145ad0cc882279f3cde", "알렉스 홀모지 비즈니스 코치 만들기", "https://m.site.naver.com/2dzNr", false],
  ["3ad55393-f0f3-8106-b299-d9e04f0eee40", "https://surf-push-7ae.notion.site/3ad55393f0f38106b299d9e04f0eee40", "내 경험을 고가 상품으로 바꾸는 상품 설계 프롬프트", "https://m.site.naver.com/2dDOZ", false],
  ["3ae55393-f0f3-8136-a3ed-f0bfc8968669", "https://surf-push-7ae.notion.site/5-3ae55393f0f38136a3edf0bfc8968669", "조회수를 모객으로 바꾸는 인스타 퍼널 프롬프트 5선", "https://m.site.naver.com/2dHin", false],
  ["3a755393-f0f3-81a8-b939-c60b6f8f428a", "https://surf-push-7ae.notion.site/3a755393f0f381a8b939c60b6f8f428a", "알렉스 홀모지 & 러셀 브런슨 수익화 전략 노트", "https://m.site.naver.com/2dIPi", false],
  ["3af55393-f0f3-8159-98bc-d5bbd69d6f37", "https://surf-push-7ae.notion.site/3af55393f0f3815998bcd5bbd69d6f37", "평범한 내 경험을 상품으로 바꾸는 상품 설계 프롬프트", "https://m.site.naver.com/2dIYq", false],
  ["3b055393-f0f3-8120-8e3a-e2d8f0ad4c8b", "https://surf-push-7ae.notion.site/7-3b055393f0f381208e3ae2d8f0ad4c8b", "고객이 망설임 없이 결제하는 세일즈 프롬프트 7가지", "https://m.site.naver.com/2dKlo", false],
  ["3b155393-f0f3-812f-bab0-c5fd945f4fc4", "https://surf-push-7ae.notion.site/60-3b155393f0f3812fbab0c5fd945f4fc4", "인스타로 돈 버는 60+가지 방법 그리고 매출이 되는 퍼널 구조", "https://m.site.naver.com/2dOjQ", false],
  ["3b255393-f0f3-81d9-b528-dda621ddf808", "https://surf-push-7ae.notion.site/0-1-000-6-3b255393f0f381d9b528dda621ddf808", "월 0원에서 월 1,000만원까지 수익 만드는 6단계", "https://m.site.naver.com/2dSEE", false],
  ["3b355393-f0f3-8165-9adc-c236355d622c", "https://surf-push-7ae.notion.site/9-3b355393f0f381659adcc236355d622c", "고객이 들어오고 결제까지 이어지는 무료 유튜브 강의 9가지", "https://m.site.naver.com/2dWVm", false],
  ["3b455393-f0f3-8102-b65e-ccce1bffab89", "https://surf-push-7ae.notion.site/PPT-GPT-3b455393f0f38102b65eccce1bffab89", "PPT 30장 챗GPT로 10분만에 만드는 프롬프트", "https://m.site.naver.com/2e0G6", false],
  ["3b555393-f0f3-8123-b047-f3b8be415bc9", "https://surf-push-7ae.notion.site/100-1-000-10-3b555393f0f38123b047f3b8be415bc9", "월 100만 원과 월 1,000만 원을 가르는 사업가의 사고법 10가지", "https://m.site.naver.com/2e59n", false],
  ["3b655393-f0f3-81a7-b9d7-e6edc14410a8", "https://surf-push-7ae.notion.site/6-3b655393f0f381a7b9d7e6edc14410a8", "고객을 모으는 클로드 프롬프트 6가지 — 알렉스 홀모지식", "https://m.site.naver.com/2e6H5", false],
  ["3b655393-f0f3-81df-a9ab-e39e333ed300", "https://surf-push-7ae.notion.site/50-3b655393f0f381dfa9abe39e333ed300", "고객이 자연스럽게 행동하게 만드는 심리학 전략 50가지", "https://m.site.naver.com/2e877", false],
  ["3b855393-f0f3-815e-a30c-e4c51d617b01", "https://surf-push-7ae.notion.site/3-3b855393f0f3815ea30ce4c51d617b01", "인스타그램이 매출로 연결되는 콘텐츠 3종류 (유입·신뢰·판매)", "https://m.site.naver.com/2ec9O", false],
  ["3b855393-f0f3-81d3-b45a-e68fdbe0f761", "https://surf-push-7ae.notion.site/7-AI-3b855393f0f381d3b45ae68fdbe0f761", "콘텐츠를 고객으로 바꾸는 7가지 AI 스킬", "https://m.site.naver.com/2ecC4", false],
  ["3b955393-f0f3-8109-8e5e-e5a297bd3d40", "https://surf-push-7ae.notion.site/0-vs-1-000-3b955393f0f381098e5ee5a297bd3d40", "월 0원의 고민 vs 월 1,000만원의 고민 — 수익 구간별 성장 전략 가이드", "https://m.site.naver.com/2eh9I", false],
  ["3ba55393-f0f3-81c8-b12d-c77529941946", "https://surf-push-7ae.notion.site/AI-8-AI-3ba55393f0f381c8b12dc77529941946", "억만장자 AI 퍼널팀 — 8명의 마케팅 전문가를 내 AI에 심는 법", "https://m.site.naver.com/2elUd", false],
  ["3bd55393-f0f3-81b5-88e3-c0a10d9fb614", "https://surf-push-7ae.notion.site/AI-7-3bd55393f0f381b588e3c0a10d9fb614", "AI 직원 7명 — 고객을 모으는 클로드 마케팅팀 세팅 가이드 [무료 미리보기]", "https://m.site.naver.com/2eqzm", false],
  ["3bd55393-f0f3-8164-b246-e8d7013921f2", "https://surf-push-7ae.notion.site/30-3bd55393f0f38164b246e8d7013921f2", "조회수 말고 고객 만드는 클로드 프롬프트 30개", "https://m.site.naver.com/2ewj2", false],
  ["3be55393-f0f3-810e-a9c7-ee991884e29c", "https://surf-push-7ae.notion.site/AI-1-7-AI-50-3be55393f0f3810ea9c7ee991884e29c", "AI 퍼널 설계도 — 고객 1명이 들어오면 움직이는 7개 AI 시스템 (미리보기 50%)", "https://m.site.naver.com/2ey3a", false],
].map(([id, url, expectedTitle, naverUrl, skipOnly], index) => ({
  index: index + 1,
  id,
  url,
  expectedTitle,
  naverUrl: naverUrl || "",
  skipOnly,
  refresh: false,
  hex: id.replaceAll("-", ""),
}));

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

function unsafeUrl(url) {
  return !url || url.startsWith("attachment:") || url.startsWith("blob:") || unsafeParts.some((part) => url.includes(part));
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

function blockFromRecord(record) {
  return record?.value?.value ?? record?.value ?? null;
}

function ingestBlocks(chunk, blocks) {
  for (const [blockId, record] of Object.entries(chunk.recordMap?.block ?? {})) {
    const block = blockFromRecord(record);
    if (block && !blocks.has(blockId)) blocks.set(blockId, block);
  }
}

async function loadSource(source) {
  const blocks = new Map();
  let cursor = { stack: [] };
  let chunkNumber = 0;
  do {
    const chunk = await requestJson(endpoint, {
      pageId: source.id,
      limit: 999999,
      cursor,
      chunkNumber,
      verticalColumns: false,
    });
    ingestBlocks(chunk, blocks);
    cursor = chunk.cursor ?? { stack: [] };
    chunkNumber += 1;
  } while (cursor.stack?.length);
  const page = blocks.get(source.id);
  if (!page) throw new Error(`Notion 페이지를 찾지 못했습니다. ${source.expectedTitle}`);
  const liveTitle = titleOf(page) || source.expectedTitle;
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
    // 연결된 하위 페이지는 제목만 두고 재귀하지 않는다.
    if (block.type === "page" && id !== source.id) return;
    if (block.type === "table_row") return;
    for (const childId of block.content ?? []) scan(childId);
  };
  if (queue.length) {
    console.error(`  누락 블록 ${queue.length}개 추가 요청. ${source.expectedTitle}`);
  }
  scan(source.id);
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
  return { source, page, blocks, liveTitle };
}

function imageMime(bytes, header) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/)) return "image/gif";
  if (Buffer.from(bytes.subarray(0, 12)).toString("ascii").match(/^RIFF....WEBP$/)) return "image/webp";
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 형식을 판별하지 못했습니다.");
}

async function responseDataUrl(response) {
  if (!response.ok) throw new Error(`미디어 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function mediaFor(item) {
  const requests = [];
  const media = new Map();
  for (const block of item.blocks.values()) {
    if (block.type !== "image") continue;
    const url = sourceOf(block);
    if (url.startsWith("data:image/")) media.set(block.id, url);
    else requests.push({ key: block.id, url, permissionRecord: { table: "block", id: block.id, spaceId: block.space_id } });
  }
  const cover = item.page.format?.page_cover;
  if (cover?.startsWith("attachment:")) {
    requests.push({
      key: `${item.source.id}:cover`,
      url: cover,
      permissionRecord: { table: "block", id: item.page.id, spaceId: item.page.space_id },
    });
  }
  for (const request of requests.filter((entry) => entry.url.startsWith("attachment:"))) {
    const signed = await requestJson(signedFileEndpoint, {
      urls: [{ permissionRecord: request.permissionRecord, url: request.url }],
    });
    const signedUrl = signed.signedUrls?.[0];
    if (!signedUrl) throw new Error(`서명 URL을 받지 못했습니다. ${item.liveTitle}`);
    media.set(request.key, await responseDataUrl(await fetch(signedUrl)));
  }
  for (const request of requests.filter((entry) => !entry.url.startsWith("attachment:"))) {
    const url = request.url.startsWith("/") ? `https://www.notion.so${request.url}` : request.url;
    media.set(request.key, await responseDataUrl(await fetch(url, {
      headers: { referer: "https://www.notion.so/", "user-agent": "Mozilla/5.0" },
    })));
  }
  if (cover && !cover.startsWith("attachment:")) {
    const url = cover.startsWith("/") ? `https://www.notion.so${cover}` : cover;
    media.set(`${item.source.id}:cover`, await responseDataUrl(await fetch(url, {
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

function fileLine(block) {
  const name = fileNameOf(block);
  return name ? `첨부 파일. ${name}` : "첨부 파일.";
}

function embedLine(block) {
  const url = sourceOf(block);
  const title = titleOf(block) || fileNameOf(block);
  if (unsafeUrl(url)) return fileLine(block);
  return title ? `[${title}](${url})` : url;
}

function documentFor(item, media) {
  const codeBlocks = [];
  function render(id, path = new Set()) {
    const block = item.blocks.get(id);
    if (!block || path.has(id)) return "";
    const nextPath = new Set(path).add(id);
    const title = titleOf(block);
    const children = (block.content ?? []).map((childId) => render(childId, nextPath)).filter(Boolean).join("\n\n");
    if (block.type === "image") {
      return media.get(block.id) ? `![${title || "Notion 이미지"}](${media.get(block.id)})` : "";
    }
    if (block.type === "file" || block.type === "pdf") return fileLine(block);
    if (block.type === "embed" || block.type === "video" || block.type === "audio" || block.type === "drive") {
      return embedLine(block);
    }
    if (block.type === "code") {
      const body = plainText(block.properties?.title);
      if (body.trim()) codeBlocks.push(body);
      return `\`\`\`${plainText(block.properties?.language) || block.format?.code_language || "text"}\n${body}\n\`\`\``;
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
    return [title, children].filter(Boolean).join("\n\n");
  }
  const cover = media.get(`${item.source.id}:cover`);
  const body = (item.page.content ?? []).map((id) => render(id)).filter(Boolean).join("\n\n");
  const sourceLine = item.source.naverUrl
    ? `> 원문. [Notion](${item.source.url}) · [네이버](${item.source.naverUrl})`
    : `> 원문. [Notion](${item.source.url})`;
  const markdown = [`# ${item.liveTitle}`, sourceLine, cover ? `![Notion 커버](${cover})` : "", body]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n");
  return {
    title: item.liveTitle,
    content: JSON.stringify(markdownToTiptapDoc(markdown)),
    codeBlocks,
    body,
    markdown,
  };
}

function promptsFor(record, source) {
  return record.codeBlocks.filter((body) => body.trim()).map((body, index) => ({
    title: `${record.title} · 프롬프트 ${String(index + 1).padStart(2, "0")}`,
    category: `Notion · ${record.title}`,
    summary: "Notion 원문에서 복사해 재사용하는 프롬프트입니다.",
    when_to_use: "원문 가이드의 해당 작업을 AI에게 요청할 때 사용하세요.",
    sections: JSON.stringify([
      { title: "프롬프트", body },
      { title: "관련 Page", body: record.title },
      { title: "원문 Notion", body: source.url },
    ]),
  }));
}

function promptBody(row) {
  try {
    const sections = typeof row.sections === "string" ? JSON.parse(row.sections) : row.sections;
    return sections.find((section) => section.title === "프롬프트")?.body ?? "";
  } catch {
    return "";
  }
}

function samePrompt(rows, prompt) {
  const body = promptBody(prompt).trim();
  return rows.some((row) => (
    (row.title === prompt.title && row.category === prompt.category)
    || (body && promptBody(row).trim() === body)
  ));
}

function pageTitlesOf(source, liveTitle) {
  return [...new Set([source.expectedTitle, liveTitle].filter(Boolean).map((title) => normalizedNotionWeekTitle(title)))];
}

function isPageDuplicate(rows, source, liveTitle) {
  const titles = pageTitlesOf(source, liveTitle);
  return rows.some((row) => {
    if (titles.includes(normalizedNotionWeekTitle(row.title))) return true;
    return row.content != null && String(row.content).includes(source.hex);
  });
}

function assertIntegrity(record) {
  const media = extractPageMediaReferences(record.content);
  if (!record.content.includes(record.source.url)) {
    throw new Error(`원문 Notion 주소가 없습니다. ${record.title}`);
  }
  if (record.source.naverUrl && !record.content.includes(record.source.naverUrl)) {
    throw new Error(`원문 네이버 주소가 없습니다. ${record.title}`);
  }
  if (unsafeParts.some((part) => record.content.includes(part))) {
    throw new Error(`만료 URL이 남아 있습니다. ${record.title}`);
  }
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error(`이미지가 data URL이 아닙니다. ${record.title}`);
  }
  const document = JSON.parse(record.content);
  const heading = document.content?.find((node) => node.type === "heading");
  const headingText = (heading?.content ?? []).map((node) => node.text ?? "").join("");
  if (!heading || headingText !== record.title) {
    throw new Error(`제목 헤딩이 없습니다. ${record.title}`);
  }
  if (!media.linkHrefs.includes(record.source.url)) {
    throw new Error(`원문 링크가 없습니다. ${record.title}`);
  }
  if (record.source.naverUrl && !media.linkHrefs.includes(record.source.naverUrl)) {
    throw new Error(`네이버 링크가 없습니다. ${record.title}`);
  }
}

function imageCountOf(content) {
  return extractPageMediaReferences(content).imageSources.length;
}

function localPageRows() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const rows = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  return rows;
}

function localPromptRows() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const rows = db.prepare("SELECT id, title, category, sections FROM prompts WHERE user_id = ?").all(localUser);
  db.close();
  return rows;
}

async function allRows(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function productionTitleRows(supabase) {
  return allRows(
    supabase.from("custom_pages").select("id, title").eq("user_id", productionUser).order("id", { ascending: true }),
  );
}

async function productionContentByIds(supabase, ids) {
  const rows = [];
  for (let index = 0; index < ids.length; index += 100) {
    const slice = ids.slice(index, index + 100);
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, title, content")
      .eq("user_id", productionUser)
      .in("id", slice);
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

async function productionHasPage(titleRows, source, liveTitle) {
  return isPageDuplicate(titleRows, source, liveTitle);
}

function createSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("필수 환경변수 누락. NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseKey) throw new Error("필수 환경변수 누락. SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function importLocal(records, skippedExisting) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = {
    pagesInserted: 0,
    pagesSkipped: skippedExisting,
    promptsInserted: 0,
    promptsSkipped: 0,
  };
  db.transaction(() => {
    const pages = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    const prompts = db.prepare("SELECT id, title, category, sections FROM prompts WHERE user_id = ?").all(localUser);
    const insertPage = db.prepare(
      "INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertPrompt = db.prepare(
      "INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
    );
    for (const record of records) {
      const existing = pages.find((page) => isPageDuplicate([page], record.source, record.title));
      if (existing && record.source.refresh && existing.content && String(existing.content).length < record.content.length) {
        db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
          .run(record.content, new Date().toISOString(), existing.id, localUser);
        existing.content = record.content;
        result.pagesInserted += 1;
        record.localPage = "update";
      } else if (existing) {
        result.pagesSkipped += 1;
        record.localPage = "skip";
      } else {
        const now = new Date().toISOString();
        insertPage.run(randomUUID(), localUser, record.title, record.content, now, now);
        pages.push({ title: record.title, content: record.content });
        result.pagesInserted += 1;
        record.localPage = "insert";
      }
      for (const prompt of record.prompts) {
        if (samePrompt(prompts, prompt)) {
          result.promptsSkipped += 1;
        } else {
          const now = new Date().toISOString();
          insertPrompt.run(
            randomUUID(),
            localUser,
            prompt.title,
            prompt.category,
            prompt.summary,
            prompt.when_to_use,
            prompt.sections,
            now,
            now,
          );
          prompts.push(prompt);
          result.promptsInserted += 1;
        }
      }
    }
  })();
  db.close();
  return result;
}

async function importProduction(supabase, records, skippedExisting, titleRows, promptRows) {
  const result = {
    pagesInserted: 0,
    pagesSkipped: skippedExisting,
    promptsInserted: 0,
    promptsSkipped: 0,
  };
  const prompts = promptRows;
  const knownPages = titleRows;
  for (const record of records) {
    const exists = await productionHasPage(knownPages, record.source, record.title);
    const existingRow = knownPages.find((row) => isPageDuplicate([row], record.source, record.title));
    if (exists && record.source.refresh && existingRow?.id) {
      const { error } = await supabase.from("custom_pages").update({
        content: record.content,
        updated_at: new Date().toISOString(),
      }).eq("id", existingRow.id).eq("user_id", productionUser);
      if (error) throw error;
      existingRow.content = record.content;
      result.pagesInserted += 1;
      record.productionPage = "update";
    } else if (exists) {
      result.pagesSkipped += 1;
      record.productionPage = "skip";
    } else {
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
      knownPages.push({ title: record.title, content: record.content });
      result.pagesInserted += 1;
      record.productionPage = "insert";
    }
    for (const prompt of record.prompts) {
      if (samePrompt(prompts, prompt)) {
        result.promptsSkipped += 1;
      } else {
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
        prompts.push(prompt);
        result.promptsInserted += 1;
      }
    }
  }
  return result;
}

const localPages = localPageRows();
const preview = sources.map((source) => {
  const localSkip = source.skipOnly || isPageDuplicate(localPages, source, source.expectedTitle);
  return {
    index: source.index,
    title: source.expectedTitle,
    skipOnly: source.skipOnly,
    local: localSkip ? "skip" : "insert",
  };
});

if (checkOnly) {
  let production = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createSupabase();
    const titleRows = await productionTitleRows(supabase);
    production = {
      pagesSkip: 0,
      pagesImport: 0,
      items: [],
    };
    for (const source of sources) {
      const skip = source.skipOnly || isPageDuplicate(titleRows, source, source.expectedTitle);
      if (skip) production.pagesSkip += 1;
      else production.pagesImport += 1;
      production.items.push({
        index: source.index,
        title: source.expectedTitle,
        skipOnly: source.skipOnly,
        production: skip ? "skip" : "insert",
      });
    }
  }
  console.log(JSON.stringify({
    writes: 0,
    requested: sources.length,
    local: {
      pagesSkip: preview.filter((item) => item.local === "skip").length,
      pagesImport: preview.filter((item) => item.local === "insert").length,
      items: preview,
    },
    production,
  }, null, 2));
  process.exit(0);
}

const supabase = createSupabase();
const productionTitles = await productionTitleRows(supabase);
const productionPrompts = await allRows(
  supabase.from("prompts").select("title, category, sections").eq("user_id", productionUser).order("id", { ascending: true }),
);
const skipOnlySources = sources.filter((source) => source.skipOnly);
const importSources = sources.filter((source) => {
  if (source.skipOnly) return false;
  if (source.refresh) return true;
  const localExists = isPageDuplicate(localPages, source, source.expectedTitle);
  const productionExists = isPageDuplicate(productionTitles, source, source.expectedTitle);
  return !(localExists && productionExists);
});
const records = [];
const failed = [];
const local = {
  pagesInserted: 0,
  pagesSkipped: sources.length - importSources.length,
  promptsInserted: 0,
  promptsSkipped: 0,
};
const production = {
  pagesInserted: 0,
  pagesSkipped: sources.length - importSources.length,
  promptsInserted: 0,
  promptsSkipped: 0,
};

for (const source of importSources) {
  try {
    console.error(`불러오는 중 ${source.index}/26. ${source.expectedTitle}`);
    const item = await loadSource(source);
    const media = await mediaFor(item);
    const document = documentFor(item, media);
    const record = {
      ...document,
      source,
      prompts: promptsFor(document, source),
      images: 0,
      emptyBody: !document.body.trim(),
    };
    assertIntegrity(record);
    record.images = imageCountOf(record.content);
    const localResult = importLocal([record], 0);
    const productionResult = await importProduction(supabase, [record], 0, productionTitles, productionPrompts);
    if (record.productionPage === "insert") {
      productionTitles.push({ title: record.title, content: record.content });
    }
    local.pagesInserted += localResult.pagesInserted;
    local.pagesSkipped += localResult.pagesSkipped;
    local.promptsInserted += localResult.promptsInserted;
    local.promptsSkipped += localResult.promptsSkipped;
    production.pagesInserted += productionResult.pagesInserted;
    production.pagesSkipped += productionResult.pagesSkipped;
    production.promptsInserted += productionResult.promptsInserted;
    production.promptsSkipped += productionResult.promptsSkipped;
    records.push(record);
    console.error(`저장 완료. 이미지 ${record.images}개, 프롬프트 ${record.prompts.length}개.`);
  } catch (error) {
    failed.push({
      index: source.index,
      title: source.expectedTitle,
      error: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error
        ? JSON.stringify(error)
        : String(error);
    console.error(`실패 ${source.index}. ${source.expectedTitle}. ${message}`);
  }
}

console.log(JSON.stringify({
  requested: sources.length,
  skipOnly: skipOnlySources.length,
  fetched: records.length,
  failed,
  local,
  production,
  pages: [
    ...skipOnlySources.map((source) => ({
      index: source.index,
      title: source.expectedTitle,
      images: 0,
      prompts: 0,
      emptyBody: false,
      local: "skip",
      production: "skip",
    })),
    ...records.map((record) => ({
      index: record.source.index,
      title: record.title,
      images: record.images,
      prompts: record.prompts.length,
      emptyBody: record.emptyBody,
      local: record.localPage,
      production: record.productionPage,
    })),
  ],
}, null, 2));
