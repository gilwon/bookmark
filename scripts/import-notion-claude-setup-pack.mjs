// 방구석 클로드코드 세팅팩 원문과 ZIP 첨부를 Pages에 안전하게 이관한다
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = "https://past-teacher-021.notion.site/CLAUDE-md-3bb3de874c4d80189cf4f2c0599b9296";
const pageId = "3bb3de87-4c4d-8018-9cf4-f2c0599b9296";
const attachmentBlockId = "3bb3de87-4c4d-80b9-bfb3-dcb4ac52e789";
const spaceId = "4d23de87-4c4d-8160-b140-00033a44b665";
const attachmentSource = "attachment:0aba3f8d-5f38-4c24-a2e3-926f44842a8f:방구석-클로드코드-세팅팩.zip";
const title = "방구석 클로드코드 세팅팩 — CLAUDE.md 무료 배포";
const expectedParagraphs = [
  "클로드 코드가 매번 되묻는 걸 없애는 세팅 파일 묶음입니다. 압축 풀고 복사하면 끝나요.",
  "구성: CLAUDE.md(40줄 미만) + settings.json(위험 명령 차단) + 기록/검수 스킬 메모 + 설치 파일 + 안내문",
  "먼저 안내문의 보안 경고 해제 순서(우클릭 속성 - 차단 해제 - 압축 풀기)를 읽고 시작하세요.",
];
const expectedZipBytes = 6307;
const expectedZipHash = "d14294a838491e13a2bdc561ecc878893761eb7fd5ad38755e0fa5dc7fba065d";
const expectedZipEntries = 9;
const loadPageEndpoint = "https://www.notion.so/api/v3/loadPageChunk";
const signedFileEndpoint = "https://www.notion.so/api/v3/getSignedFileUrls";
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

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
const {
  PAGE_ATTACHMENT_CLAUDE_SETUP_FILENAME,
  PAGE_ATTACHMENT_CLAUDE_SETUP_SOURCE_ID,
  PAGE_ATTACHMENT_STORAGE_BUCKET,
  PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT,
  PAGE_ATTACHMENT_STORAGE_MIME,
  createPageAttachmentObjectPath,
  extractPageMediaReferences,
  planExactPageAttachmentAction,
} = require(resolve(root, "src/lib/page-attachment-storage.ts"));

const attachmentUrl = `/api/page-attachments/${PAGE_ATTACHMENT_CLAUDE_SETUP_SOURCE_ID}/${encodeURIComponent(PAGE_ATTACHMENT_CLAUDE_SETUP_FILENAME)}`;
const sourceMarkers = [sourceUrl, pageId, PAGE_ATTACHMENT_CLAUDE_SETUP_SOURCE_ID];
const bucketOptions = {
  public: false,
  fileSizeLimit: PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT,
  allowedMimeTypes: [PAGE_ATTACHMENT_STORAGE_MIME],
};

function plainText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((fragment) => Array.isArray(fragment) ? plainText(fragment[0]) : plainText(fragment)).join("");
}

async function sourceRecord() {
  const response = await fetch(loadPageEndpoint, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: JSON.stringify({ pageId, limit: 999999, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }),
  });
  if (!response.ok) throw new Error(`Notion HTTP ${response.status}`);
  const chunk = await response.json();
  const blocks = new Map(Object.entries(chunk.recordMap?.block ?? {}).flatMap(([id, record]) => record?.value?.value ? [[id, record.value.value]] : []));
  const page = blocks.get(pageId);
  const children = (page?.content ?? []).map((id) => blocks.get(id));
  const paragraphs = children.filter((block) => block?.type === "text").map((block) => plainText(block.properties?.title).trim());
  const file = children.find((block) => block?.type === "file");
  const filename = plainText(file?.properties?.title).trim();
  const source = plainText(file?.properties?.source).trim();
  if (
    plainText(page?.properties?.title).trim() !== title ||
    page?.content?.length !== 4 ||
    children.some((block) => !block) ||
    paragraphs.length !== 3 ||
    !paragraphs.every((paragraph, index) => paragraph === expectedParagraphs[index]) ||
    file?.id !== attachmentBlockId ||
    file?.space_id !== spaceId ||
    filename !== PAGE_ATTACHMENT_CLAUDE_SETUP_FILENAME ||
    source !== attachmentSource
  ) {
    throw new Error("Notion 원문 구조 또는 첨부 메타데이터 검증에 실패했습니다.");
  }
  return { paragraphs, file: { id: file.id, spaceId: file.space_id, filename, source } };
}

function zipEntryCount(bytes) {
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) {
      return bytes[index + 10] | (bytes[index + 11] << 8);
    }
  }
  throw new Error("ZIP 중앙 디렉터리를 찾지 못했습니다.");
}

export function verifyClaudeSetupZip(bytes) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const entries = zipEntryCount(bytes);
  if (
    expectedZipBytes > PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT ||
    bytes.byteLength !== expectedZipBytes ||
    bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04 ||
    hash !== expectedZipHash ||
    entries !== expectedZipEntries
  ) {
    throw new Error("방구석 클로드코드 세팅팩 ZIP 무결성 검증에 실패했습니다.");
  }
  return { bytes: bytes.byteLength, sha256: hash, entries };
}

function verifyInvalidZipRejection(bytes) {
  const altered = bytes.slice();
  altered[100] ^= 1;
  const invalidFiles = [altered, bytes.slice(0, -1)];
  for (const invalid of invalidFiles) {
    assert.throws(() => verifyClaudeSetupZip(invalid), /ZIP/);
  }
  return invalidFiles.length;
}

async function downloadAttachment(file) {
  const signedResponse = await fetch(signedFileEndpoint, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: JSON.stringify({ urls: [{ permissionRecord: { table: "block", id: file.id, spaceId: file.spaceId }, url: file.source }] }),
  });
  if (!signedResponse.ok) throw new Error(`Notion 첨부 서명 HTTP ${signedResponse.status}`);
  const signed = await signedResponse.json();
  if (!Array.isArray(signed.signedUrls) || signed.signedUrls.length !== 1 || typeof signed.signedUrls[0] !== "string") {
    throw new Error("Notion 첨부 서명 URL 검증에 실패했습니다.");
  }
  const response = await fetch(signed.signedUrls[0]);
  if (!response.ok) throw new Error(`Notion 첨부 다운로드 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, integrity: verifyClaudeSetupZip(bytes) };
}

function pageRecord(paragraphs) {
  const markdown = [
    `# ${title}`,
    `> 원문. [Notion](${sourceUrl})`,
    ...paragraphs,
    `[${PAGE_ATTACHMENT_CLAUDE_SETUP_FILENAME}](${attachmentUrl})`,
  ].join("\n\n");
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const media = extractPageMediaReferences(content);
  if (
    media.imageSources.length !== 0 ||
    media.linkHrefs.filter((href) => href === sourceUrl).length !== 1 ||
    media.linkHrefs.filter((href) => href === attachmentUrl).length !== 1 ||
    content.includes(attachmentSource) ||
    /blob:|X-Amz-|prod-files-secure|expirationTimestamp/.test(content)
  ) {
    throw new Error("Page 변환 무결성 검증에 실패했습니다.");
  }
  return { title, content, markdown };
}

function plan(rows, page) {
  return planExactPageAttachmentAction(rows, page.title, sourceMarkers, page.content, [attachmentUrl]);
}

function localRows() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const rows = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  return rows;
}

async function productionCandidates(supabase) {
  const queries = [
    supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser).eq("title", title).limit(2),
    ...sourceMarkers.map((marker) => supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser).like("content", `%${marker}%`).limit(2)),
  ];
  const results = await Promise.all(queries);
  const rows = new Map();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const row of data ?? []) rows.set(row.id, row);
  }
  return [...rows.values()];
}

async function productionRowCount(supabase) {
  const { count, error } = await supabase.from("custom_pages").select("id", { count: "exact", head: true }).eq("user_id", productionUser);
  if (error) throw error;
  return count ?? 0;
}

function bucketMatches(bucket) {
  return bucket.public === false &&
    bucket.file_size_limit === bucketOptions.fileSizeLimit &&
    Array.isArray(bucket.allowed_mime_types) &&
    bucket.allowed_mime_types.length === 1 &&
    bucket.allowed_mime_types[0] === PAGE_ATTACHMENT_STORAGE_MIME;
}

async function ensureBucket(supabase) {
  const { data, error } = await supabase.storage.getBucket(PAGE_ATTACHMENT_STORAGE_BUCKET);
  if (error?.status === 404 || error?.statusCode === "404") {
    const { error: createError } = await supabase.storage.createBucket(PAGE_ATTACHMENT_STORAGE_BUCKET, bucketOptions);
    if (createError) throw createError;
    return "created";
  }
  if (error) throw error;
  if (!bucketMatches(data)) {
    const { error: updateError } = await supabase.storage.updateBucket(PAGE_ATTACHMENT_STORAGE_BUCKET, bucketOptions);
    if (updateError) throw updateError;
    return "updated";
  }
  return "unchanged";
}

function objectPaths() {
  const paths = [localUser, productionUser].map((userId) => createPageAttachmentObjectPath(userId, PAGE_ATTACHMENT_CLAUDE_SETUP_SOURCE_ID, PAGE_ATTACHMENT_CLAUDE_SETUP_FILENAME));
  if (paths.some((path) => !path)) throw new Error("첨부 Storage 경로 검증에 실패했습니다.");
  return paths;
}

async function uploadAttachment(supabase, bytes) {
  for (const path of objectPaths()) {
    const { error } = await supabase.storage.from(PAGE_ATTACHMENT_STORAGE_BUCKET).upload(path, bytes, { contentType: PAGE_ATTACHMENT_STORAGE_MIME, upsert: true });
    if (error) throw error;
  }
  return objectPaths().length;
}

function importLocal(page) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { inserted: 0, updated: 0, skipped: 0 };
  db.transaction(() => {
    const action = plan(db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser), page);
    const now = new Date().toISOString();
    if (action.action === "insert") {
      db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(randomUUID(), localUser, page.title, page.content, now, now);
      result.inserted += 1;
    } else if (action.action === "update") {
      db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(page.content, now, action.row.id, localUser);
      result.updated += 1;
    } else result.skipped += 1;
  })();
  db.close();
  return result;
}

async function importProduction(supabase, rows, page) {
  const action = plan(rows, page);
  const result = { inserted: 0, updated: 0, skipped: 0 };
  const now = new Date().toISOString();
  if (action.action === "insert") {
    const { error } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: page.title, content: page.content, created_at: now, updated_at: now });
    if (error) throw error;
    result.inserted += 1;
  } else if (action.action === "update") {
    const { error } = await supabase.from("custom_pages").update({ content: page.content, updated_at: now }).eq("id", action.row.id).eq("user_id", productionUser);
    if (error) throw error;
    result.updated += 1;
  } else result.skipped += 1;
  return result;
}

async function verifyStored(supabase, page) {
  const local = plan(localRows(), page);
  const production = plan(await productionCandidates(supabase), page);
  if (local.action !== "skip" || production.action !== "skip") throw new Error("저장 Page 후검증에 실패했습니다.");
  for (const path of objectPaths()) {
    const { data, error } = await supabase.storage.from(PAGE_ATTACHMENT_STORAGE_BUCKET).info(path);
    if (error || Number(data?.metadata?.size ?? data?.size) !== expectedZipBytes) throw error ?? new Error("저장 ZIP 후검증에 실패했습니다.");
  }
  return { local: local.action, production: production.action, objects: objectPaths().length };
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
}
const source = await sourceRecord();
const attachment = await downloadAttachment(source.file);
const page = pageRecord(source.paragraphs);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const currentLocalRows = localRows();
const localPreflight = plan(currentLocalRows, page);
const [productionRows, productionRowsTotal] = await Promise.all([productionCandidates(supabase), productionRowCount(supabase)]);
const productionPreflight = plan(productionRows, page);
const { data: bucket, error: bucketError } = await supabase.storage.getBucket(PAGE_ATTACHMENT_STORAGE_BUCKET);
if (bucketError) throw bucketError;

if (process.argv.includes("--check")) {
  const invalidZipRejections = verifyInvalidZipRejection(attachment.bytes);
  console.log(JSON.stringify({
    title,
    source: { pageId, directChildren: 4, paragraphs: source.paragraphs.length, attachmentBlockId, filename: source.file.filename },
    zip: { ...attachment.integrity, invalidZipRejections },
    attachmentUrl,
    objectPaths: objectPaths(),
    bucket: { name: bucket.name, matches: bucketMatches(bucket) },
    preflight: {
      local: { rows: currentLocalRows.length, action: localPreflight.action },
      production: { rows: productionRowsTotal, candidates: productionRows.length, action: productionPreflight.action },
    },
    images: 0,
    attachments: 1,
    writes: 0,
  }, null, 2));
  process.exit(0);
}

const bucketState = await ensureBucket(supabase);
const uploads = await uploadAttachment(supabase, attachment.bytes);
const local = importLocal(page);
const production = await importProduction(supabase, productionRows, page);
const verify = await verifyStored(supabase, page);
console.log(JSON.stringify({ bucket: bucketState, uploads, local, production, verify }, null, 2));
