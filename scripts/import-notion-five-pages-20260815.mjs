// 공개 Notion 자료 5건을 이미지와 함께 Pages에 중복 없이 저장한다
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const loadPageEndpoint = "https://www.notion.so/api/v3/loadPageChunk";
const signedFileEndpoint = "https://www.notion.so/api/v3/getSignedFileUrls";
const pdfUrl = "https://drive.google.com/uc?export=download&id=148M8lXo1ZrXLvMph_Q6_X97r4qT0z1x0";
const pdfFilename = "GPT업무명령어100_v1_20260813.pdf";
const pdfBytes = 149489;
const pdfSha256 = "40207b46eedc9cd775843f0dd868d5d59da7ade2c2f57d94a359fd9f43f92d2e";
const unsafeParts = ["file.notion.so", "prod-files-secure", "expirationTimestamp", "X-Amz", "Security-Token"];
const sources = [
  {
    id: "31d24de3-6afa-8007-8385-e1b90bbfb29e",
    url: "https://foamy-willow-1ed.notion.site/31d24de36afa80078385e1b90bbfb29e",
    title: "상세페이지 자동 분석 & 구성 템플릿 활용법 메뉴얼",
    blocks: 75,
    chunks: 1,
    images: 1,
  },
  {
    id: "3bc9770d-f064-800d-9930-eb013c4f8447",
    url: "https://halved-stretch-7af.notion.site/10-GPT-3bc9770df064800d9930eb013c4f8447",
    title: "내 분야에서 유명해지는 10가지 GPT 프롬프트",
    blocks: 154,
    chunks: 2,
    images: 5,
  },
  {
    id: "3bc64e2b-5936-80a3-ac8e-eb1a8892113a",
    url: "https://app.notion.com/p/3-3bc64e2b593680a3ac8eeb1a8892113a",
    title: "(공유) 카페 포스터 스타일 3종",
    blocks: 63,
    chunks: 1,
    images: 10,
  },
  {
    id: "3bc91cb2-3c4d-80d4-b865-c2bcce09d5b0",
    url: "https://exultant-principle-9c5.notion.site/GPT-100-3bc91cb23c4d80d4b865c2bcce09d5b0",
    title: "일잘알들이 쓰는 GPT 스킬 100개",
    blocks: 5,
    chunks: 1,
    images: 1,
    attachment: pdfUrl,
  },
  {
    id: "3b8d730b-3953-81d4-9fa9-c34d8a073c2c",
    url: "https://fieldby.notion.site/100-33-3b8d730b395381d49fa9c34d8a073c2c",
    title: "클로드 명령어 100개 + 보너스 33개",
    blocks: 186,
    chunks: 3,
    images: 0,
  },
];

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
const { extractPageMediaReferences, planNotionWeekPageAction } = require(
  resolve(root, "src/lib/page-attachment-storage.ts")
);

function plainText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((fragment) => Array.isArray(fragment) ? plainText(fragment[0]) : plainText(fragment)).join("");
}

function cleanUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    url.searchParams.delete("fbclid");
    url.searchParams.delete("source");
    return url.toString();
  } catch {
    return value;
  }
}

function richText(value) {
  if (!Array.isArray(value)) return plainText(value) ? [{ type: "text", text: plainText(value) }] : [];
  return value.flatMap((fragment) => {
    if (typeof fragment === "string") return fragment ? [{ type: "text", text: fragment }] : [];
    if (!Array.isArray(fragment)) return [];
    const text = plainText(fragment[0]);
    if (!text) return [];
    const marks = [];
    for (const mark of Array.isArray(fragment[1]) ? fragment[1] : []) {
      if (!Array.isArray(mark)) continue;
      if (mark[0] === "a" && mark[1]) marks.push({ type: "link", attrs: { href: cleanUrl(mark[1]) } });
      if (mark[0] === "b") marks.push({ type: "bold" });
      if (mark[0] === "i") marks.push({ type: "italic" });
      if (mark[0] === "c") marks.push({ type: "code" });
      if (mark[0] === "s") marks.push({ type: "strike" });
    }
    return [{ type: "text", text, ...(marks.length ? { marks } : {}) }];
  });
}

function paragraph(value, marks) {
  const content = marks ?? richText(value);
  return { type: "paragraph", ...(content.length ? { content } : {}) };
}

async function loadSource(source) {
  const blocks = new Map();
  let cursor = { stack: [] };
  let chunkNumber = 0;
  do {
    const response = await fetch(loadPageEndpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
      body: JSON.stringify({ pageId: source.id, limit: 999999, cursor, chunkNumber, verticalColumns: false }),
    });
    if (!response.ok) throw new Error(`Notion HTTP ${response.status}: ${source.id}`);
    const chunk = await response.json();
    for (const [id, record] of Object.entries(chunk.recordMap?.block ?? {})) {
      if (record?.value?.value) blocks.set(id, record.value.value);
    }
    cursor = chunk.cursor ?? { stack: [] };
    chunkNumber += 1;
  } while (cursor.stack?.length);
  const page = blocks.get(source.id);
  if (!page || blocks.size !== source.blocks || chunkNumber !== source.chunks || plainText(page.properties?.title).trim() !== source.title) {
    throw new Error(`Notion 원문 구조 무결성 검증 실패: ${source.title}`);
  }
  const missing = [...blocks.values()].filter((block) => block.type !== "page").flatMap((block) => block.content ?? []).filter((id) => !blocks.has(id));
  if (missing.length) throw new Error(`Notion 하위 블록 누락: ${source.title}`);
  return { source, blocks, page, chunkNumber };
}

function imageMime(bytes, header) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/)) return "image/gif";
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 MIME을 판별하지 못했습니다.");
}

function verifyDataUrl(value) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(value);
  if (!match || Buffer.from(match[2], "base64").byteLength === 0) throw new Error("이미지 data URL 무결성 검증 실패");
  return value;
}

async function resolveImages(items) {
  const requests = [];
  const direct = new Map();
  for (const { source, blocks, page } of items) {
    for (const block of blocks.values()) {
      if (block.type !== "image") continue;
      const value = plainText(block.properties?.source) || block.format?.display_source;
      if (value.startsWith("data:image/")) direct.set(block.id, verifyDataUrl(value));
      else requests.push({ sourceId: source.id, key: block.id, permissionRecord: { table: "block", id: block.id, spaceId: block.space_id }, url: value });
    }
    if (page.format?.page_cover) {
      requests.push({ sourceId: source.id, key: `${source.id}:cover`, permissionRecord: { table: "block", id: page.id, spaceId: page.space_id }, url: page.format.page_cover });
    }
  }
  for (const source of sources) {
    const group = requests.filter(({ sourceId }) => sourceId === source.id);
    if (!group.length) continue;
    const response = await fetch(signedFileEndpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
      body: JSON.stringify({ urls: group.map(({ permissionRecord, url }) => ({ permissionRecord, url })) }),
    });
    if (!response.ok) throw new Error(`Notion 이미지 서명 HTTP ${response.status}: ${source.title}`);
    const { signedUrls } = await response.json();
    if (!Array.isArray(signedUrls) || signedUrls.length !== group.length) throw new Error("Notion 이미지 서명 결과 불일치");
    await Promise.all(group.map(async ({ key }, index) => {
      const imageResponse = await fetch(signedUrls[index]);
      if (!imageResponse.ok) throw new Error(`Notion 이미지 다운로드 HTTP ${imageResponse.status}`);
      const bytes = new Uint8Array(await imageResponse.arrayBuffer());
      const mime = imageMime(bytes, imageResponse.headers.get("content-type"));
      direct.set(key, `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`);
    }));
  }
  return direct;
}

async function verifyPdf() {
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error(`PDF 다운로드 HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== pdfBytes || bytes.subarray(0, 8).toString("ascii") !== "%PDF-1.4" || hash !== pdfSha256) {
    throw new Error("PDF 바이트 또는 해시 무결성 검증 실패");
  }
  return { bytes: bytes.byteLength, sha256: hash };
}

function tableNode(block, blocks) {
  const columns = block.format?.table_block_column_order ?? [];
  const rows = (block.content ?? []).map((id) => blocks.get(id)).filter(Boolean);
  return {
    type: "table",
    content: rows.map((row, rowIndex) => ({
      type: "tableRow",
      content: columns.map((column) => ({
        type: rowIndex === 0 ? "tableHeader" : "tableCell",
        content: [paragraph(row.properties?.[column])],
      })),
    })),
  };
}

function linkParagraph(label, url) {
  return paragraph(null, [{ type: "text", text: label, marks: [{ type: "link", attrs: { href: cleanUrl(url) } }] }]);
}

function documentFor(item, images) {
  const { source, blocks, page } = item;
  let pdfRendered = false;
  function render(id, path = new Set()) {
    const block = blocks.get(id);
    if (!block || path.has(id)) return [];
    const nextPath = new Set(path).add(id);
    const children = (block.content ?? []).flatMap((childId) => render(childId, nextPath));
    const title = block.properties?.title;
    const type = block.type;
    if (type === "text" && plainText(title).replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, "").trim() === source.title) return children;
    if (type === "text") return [paragraph(title), ...children];
    if (["header", "header_1", "header_2", "header_3", "header_4", "sub_header", "sub_sub_header"].includes(type)) {
      const levels = { header: 1, header_1: 1, header_2: 2, header_3: 3, header_4: 3, sub_header: 2, sub_sub_header: 3 };
      return [{ type: "heading", attrs: { level: levels[type] }, content: richText(title) }, ...children];
    }
    if (type === "divider") return [{ type: "horizontalRule" }];
    if (type === "quote") return [{ type: "blockquote", content: [paragraph(title), ...children] }];
    if (type === "callout") return [{ type: "callout", content: [paragraph(title), ...children] }];
    if (type === "bulleted_list" || type === "numbered_list") {
      return [{ type: type === "bulleted_list" ? "bulletList" : "orderedList", content: [{ type: "listItem", content: [paragraph(title), ...children] }] }];
    }
    if (type === "to_do") {
      const checked = /^(yes|true)$/i.test(plainText(block.properties?.checked));
      return [{ type: "taskList", content: [{ type: "taskItem", attrs: { checked }, content: [paragraph(title), ...children] }] }];
    }
    if (type === "table") return [tableNode(block, blocks)];
    if (type === "table_row") return [];
    if (type === "image") return [{ type: "image", attrs: { src: images.get(block.id), alt: plainText(title) || "Notion 이미지" } }];
    if (type === "bookmark") {
      const url = plainText(block.properties?.link);
      return [linkParagraph(plainText(title) || url, url), ...children];
    }
    if ((type === "embed" || type === "external_object_instance") && source.attachment === pdfUrl) {
      if (pdfRendered || type === "external_object_instance") return children;
      pdfRendered = true;
      return [linkParagraph(pdfFilename, pdfUrl), ...children];
    }
    if (["embed", "external_object", "external_object_instance", "link_preview"].includes(type)) {
      const url = plainText(block.properties?.source) || block.format?.original_url || plainText(title);
      return url ? [linkParagraph(block.format?.link_title || plainText(title) || url, url), ...children] : children;
    }
    if (type === "column_list" || type === "column") return children;
    if (type === "page") return plainText(title) ? [paragraph(title)] : [];
    return [...(plainText(title) ? [paragraph(title)] : []), ...children];
  }
  const content = [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: source.title }] },
    { type: "blockquote", content: [linkParagraph("원문 Notion", source.url)] },
  ];
  const cover = images.get(`${source.id}:cover`);
  if (cover) content.push({ type: "image", attrs: { src: cover, alt: "Notion 표지" } });
  content.push(...(page.content ?? []).flatMap((id) => render(id)));
  const document = { type: "doc", content };
  if (source.attachment && !pdfRendered) throw new Error(`PDF 링크 변환 실패: ${source.title}`);
  return JSON.stringify(document);
}

function countOccurrences(value, part) {
  return value.split(part).length - 1;
}

function tableDimensions(content) {
  const document = JSON.parse(content);
  const table = document.content.find((node) => node.type === "table");
  return table ? [table.content.length, table.content[0]?.content?.length ?? 0] : null;
}

function validateRecords(records) {
  let totalImages = 0;
  for (const record of records) {
    const media = extractPageMediaReferences(record.content);
    totalImages += media.imageSources.length;
    for (const value of media.imageSources) verifyDataUrl(value);
    const checks = {
      images: media.imageSources.length === record.source.images,
      source: countOccurrences(record.content, record.source.url) === 1,
      title: countOccurrences(record.content, record.source.title) === 1,
      safe: !unsafeParts.some((part) => record.content.includes(part)) && !record.content.includes("fbclid=") && !/https?:[^" ]*[?&]source=/.test(record.content),
      attachment: !record.source.attachment || media.linkHrefs.filter((href) => href === record.source.attachment).length === 1,
    };
    if (Object.values(checks).some((value) => !value)) throw new Error(`Page 변환 무결성 검증 실패: ${record.source.title} ${JSON.stringify(checks)}`);
  }
  if (totalImages !== 17 || JSON.stringify(tableDimensions(records[0].content)) !== JSON.stringify([6, 3])) {
    throw new Error("전체 이미지 또는 6×3 표 무결성 검증 실패");
  }
  return { pages: records.length, images: totalImages, table: tableDimensions(records[0].content) };
}

function sourceMarkers(record) {
  return [record.source.url, record.source.id, record.source.id.replaceAll("-", "")];
}

function plansFor(rows, records) {
  return records.map((record) => ({
    record,
    ...planNotionWeekPageAction(rows, record.source.title, sourceMarkers(record), record.imageSources, record.attachments),
  }));
}

function localRows() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const rows = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  return rows;
}

function normalizedTitle(value) {
  return typeof value === "string"
    ? value.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR")
    : "";
}

async function productionRows(supabase) {
  const metadata = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("custom_pages").select("id, title").eq("user_id", productionUser).order("id", { ascending: true }).range(from, from + 999);
    if (error) throw error;
    metadata.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // ponytail: 운영에서는 제목 후보만 읽는다. 이름 변경 중복까지 필요하면 source ID 전용 컬럼과 인덱스를 추가한다.
  const expectedTitles = new Set(sources.map((source) => normalizedTitle(source.title)));
  const ids = metadata.filter((row) => expectedTitles.has(normalizedTitle(row.title))).map((row) => row.id);
  if (!ids.length) return [];
  const { data, error } = await supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser).in("id", ids);
  if (error) throw error;
  return data ?? [];
}

function importLocal(records) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { inserted: 0, updated: 0, skipped: 0 };
  db.transaction(() => {
    const plans = plansFor(db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser), records);
    const insert = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    const update = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
    for (const { record, action, row } of plans) {
      if (action === "insert") {
        const now = new Date().toISOString();
        insert.run(randomUUID(), localUser, record.source.title, record.content, now, now);
      } else if (action === "update") update.run(record.content, new Date().toISOString(), row.id, localUser);
      result[action === "skip" ? "skipped" : `${action}ed`] += 1;
    }
  })();
  db.close();
  return result;
}

async function importProduction(supabase, records) {
  const rows = await productionRows(supabase);
  const plans = plansFor(rows, records);
  const result = { inserted: 0, updated: 0, skipped: 0 };
  for (const { record, action, row } of plans) {
    if (action === "insert") {
      const now = new Date().toISOString();
      const { error } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: record.source.title, content: record.content, created_at: now, updated_at: now });
      if (error) throw error;
    } else if (action === "update") {
      const { error } = await supabase.from("custom_pages").update({ content: record.content, updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", productionUser);
      if (error) throw error;
    }
    result[action === "skip" ? "skipped" : `${action}ed`] += 1;
  }
  return result;
}

function verifyRows(rows, records) {
  const plans = plansFor(rows, records);
  if (plans.some(({ action }) => action !== "skip")) throw new Error("저장 Page 후검증 실패");
  return validateRecords(plans.map(({ record, row }) => ({ ...record, content: row.content })));
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
}
const items = await Promise.all(sources.map(loadSource));
const [images, pdf] = await Promise.all([resolveImages(items), verifyPdf()]);
const records = items.map((item) => {
  const content = documentFor(item, images);
  const media = extractPageMediaReferences(content);
  return { source: item.source, content, imageSources: media.imageSources, attachments: item.source.attachment ? [item.source.attachment] : [] };
});
const integrity = validateRecords(records);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const localPreflight = plansFor(localRows(), records).map(({ action }) => action);
const productionPreflightRows = await productionRows(supabase);
const productionPreflight = plansFor(productionPreflightRows, records).map(({ action }) => action);

if (process.argv.includes("--check")) {
  console.log(JSON.stringify({ integrity, chunks: items.map(({ chunkNumber }) => chunkNumber), pdf, preflight: { local: localPreflight, production: productionPreflight }, writes: 0 }, null, 2));
  process.exit(0);
}

const local = importLocal(records);
const production = await importProduction(supabase, records);
const verify = {
  local: verifyRows(localRows(), records),
  production: verifyRows(await productionRows(supabase), records),
};
console.log(JSON.stringify({ integrity, pdf, preflight: { local: localPreflight, production: productionPreflight }, local, production, verify }, null, 2));
