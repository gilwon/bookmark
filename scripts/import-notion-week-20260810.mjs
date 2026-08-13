// 2026년 8월 10일 이후 Notion Page 14건을 미디어와 함께 이관한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { pageData } from "./notion-week-20260810-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const assetDirectory = "/Users/gilwon/Downloads/notion-week-20260810";
const moodmodeAssetId = "0e7b2568-27ac-82de-8fce-8194c7e6a4c7";
const moodmodeBytes = 10279989;
const cutoff = "2026-08-09T15:00:00.000Z";
const unsafeParts = ["bl" + "ob:", "expiration" + "Timestamp", "prod" + "-files-secure", "X-" + "Amz", "Security" + "-Token"];

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
const {
  PAGE_ATTACHMENT_MOODMODE_FILENAME,
  PAGE_ATTACHMENT_MOODMODE_SOURCE_ID,
  PAGE_ATTACHMENT_FILENAMES,
  PAGE_ATTACHMENT_SOURCE_ID,
  PAGE_ATTACHMENT_STORAGE_BUCKET,
  PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT,
  PAGE_ATTACHMENT_STORAGE_MIME,
  extractPageMediaReferences,
  createPageAttachmentObjectPath,
  planNotionWeekPageAction,
} = require(resolve(root, "src/lib/page-attachment-storage.ts"));
const moodmodeSourceId = PAGE_ATTACHMENT_MOODMODE_SOURCE_ID;
const moodmodeFilename = PAGE_ATTACHMENT_MOODMODE_FILENAME;
const kimhyoExpected = {
  title: "김효율 스킬팩",
  sourceMarkers: ["https://app.notion.com/p/gilwon/5a5b256827ac8287b9b381e50f142820", PAGE_ATTACHMENT_SOURCE_ID],
  attachmentUrls: PAGE_ATTACHMENT_FILENAMES.map((filename) => `/api/page-attachments/${PAGE_ATTACHMENT_SOURCE_ID}/${encodeURIComponent(filename)}`),
};

function contentFromNotion(text) {
  return (text.match(/<content>\n([\s\S]*?)\n<\/content>/)?.[1] ?? text).trim();
}

function preserveNotionReferences(value) {
  return value
    .replace(/<(page|database)\b([^>]*)>([\s\S]*?)<\/\1>/g, (_match, tag, attributes, label) => {
      const url = attributes.match(/\burl="([^"]+)"/)?.[1];
      return url ? `[${label.trim() || tag}](${url})` : label;
    })
    .replace(/<(unknown(?:_mention)?)\b([^>]*)\/>/g, (_match, _tag, attributes) => {
      const url = attributes.match(/\burl="([^"]+)"/)?.[1];
      const label = attributes.match(/\balt="([^"]+)"/)?.[1] ?? "참조";
      return url ? `[${label}](${url})` : "";
    });
}

function imagePaths() {
  const paths = new Map();
  for (const filename of readdirSync(assetDirectory).filter((name) => /\.(?:png|jpe?g)$/i.test(name)).sort()) {
    const sourceId = filename.slice(0, 36).replaceAll("-", "");
    if (!/^[0-9a-f]{32}$/.test(sourceId)) throw new Error(`이미지 파일명이 올바르지 않습니다: ${filename}`);
    const list = paths.get(sourceId) ?? [];
    list.push(resolve(assetDirectory, filename));
    paths.set(sourceId, list);
  }
  return paths;
}

function dataUrl(path) {
  const type = extname(path).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  return `data:${type};base64,${readFileSync(path).toString("base64")}`;
}

function replaceImagePlaceholders(value, sourceId, paths) {
  let index = 0;
  const output = value.replace(new RegExp(`notion-week-image://${sourceId}/(\\d+)`, "g"), (_match, marker) => {
    const expected = Number(marker);
    if (expected !== ++index || !paths[index - 1]) throw new Error(`이미지 순서 또는 파일이 올바르지 않습니다: ${sourceId}`);
    return dataUrl(paths[index - 1]);
  });
  if (index !== paths.length) throw new Error(`원문 이미지와 파일 수가 다릅니다: ${sourceId}`);
  return output;
}

function attachmentUrl(sourceId) {
  return `/api/page-attachments/${sourceId}/${encodeURIComponent(moodmodeFilename)}`;
}

function markdownFor(page, paths) {
  const body = replaceImagePlaceholders(
    contentFromNotion(page.notionContent)
      .replace(/<file\b[^>]*><\/file>/g, `[${moodmodeFilename}](${attachmentUrl(page.id.replaceAll("-", ""))})`),
    page.id,
    paths
  );
  return normalizePasteToMarkdown([
    `# ${page.title}`,
    `> 원문. [Notion](${page.source})`,
    preserveNotionReferences(body),
  ].join("\n\n")).trim();
}

const allImagePaths = imagePaths();
const records = pageData.map((page) => {
  const sourceId = page.id.replaceAll("-", "");
  const paths = allImagePaths.get(sourceId) ?? [];
  const markdown = markdownFor(page, paths);
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const attachments = sourceId === moodmodeSourceId ? [attachmentUrl(sourceId)] : [];
  const mediaReferences = extractPageMediaReferences(content);
  if (unsafeParts.some((part) => content.includes(part)) || mediaReferences.imageSources.length !== paths.length || attachments.some((url) => !mediaReferences.linkHrefs.includes(url))) {
    throw new Error(`Notion Page 변환 무결성 검증에 실패했습니다: ${page.title}`);
  }
  return { ...page, sourceId, content, imageSources: mediaReferences.imageSources, attachments };
});

const totalImages = records.reduce((count, record) => count + record.imageSources.length, 0);
const totalAttachments = records.reduce((count, record) => count + record.attachments.length, 0);
const integrity = {
  pages: records.length === 14,
  dates: records.every((record) => new Date(record.createdAt).toISOString() > cutoff),
  images: totalImages === 11,
  attachments: totalAttachments === 1,
  sources: records.every((record) => record.content.includes(record.source)),
};
if (Object.values(integrity).some((value) => !value)) {
  throw new Error(`Notion Page 원문 또는 미디어 무결성 검증에 실패했습니다: ${JSON.stringify(integrity)}`);
}

function sourceMarkers(record) {
  return [record.source, record.sourceId];
}

function plansFor(rows) {
  return records.map((record) => ({
    record,
    ...planNotionWeekPageAction(rows, record.title, sourceMarkers(record), record.imageSources, record.attachments),
  }));
}

function assertKimhyoComplete(rows) {
  const plan = planNotionWeekPageAction(
    rows,
    kimhyoExpected.title,
    kimhyoExpected.sourceMarkers,
    [],
    kimhyoExpected.attachmentUrls
  );
  if (plan.action !== "skip") {
    throw new Error("김효율 스킬팩은 scripts/import-notion-kimhyo-skills-page.mjs로 먼저 보완해야 합니다.");
  }
  return plan.row;
}

function verifyRows(rows) {
  assertKimhyoComplete(rows);
  const plans = plansFor(rows);
  for (const { record, action, row } of plans) {
    if (!row) throw new Error("저장 Page 무결성 검증에 실패했습니다.");
    const mediaReferences = extractPageMediaReferences(row.content);
    if (
      record.imageSources.some((source) => !mediaReferences.imageSources.includes(source)) ||
      record.attachments.some((url) => !mediaReferences.linkHrefs.includes(url)) ||
      unsafeParts.some((part) => row.content.includes(part)) ||
      (action !== "skip" && !row.content.includes(record.source))
    ) {
      throw new Error("저장 Page 미디어 무결성 검증에 실패했습니다.");
    }
  }
  return { pages: plans.length, images: totalImages, attachments: totalAttachments };
}

function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { inserted: 0, updated: 0, skipped: 0 };
  db.transaction(() => {
    const rows = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    assertKimhyoComplete(rows);
    const plans = plansFor(rows);
    const insert = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    const update = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
    for (const { record, action, row } of plans) {
      if (action === "insert") {
        const now = new Date().toISOString();
        insert.run(randomUUID(), localUser, record.title, record.content, now, now);
        result.inserted += 1;
      } else if (action === "update") {
        update.run(record.content, new Date().toISOString(), row.id, localUser);
        result.updated += 1;
      } else {
        result.skipped += 1;
      }
    }
  })();
  db.close();
  return result;
}

function localRows() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const rows = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  return rows;
}

async function allRows(query) {
  const rows = [];
  for (let from = 0; ; from += 100) {
    const { data, error } = await query.range(from, from + 99);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 100) return rows;
  }
}

function bucketOptions() {
  return {
    public: false,
    fileSizeLimit: PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT,
    allowedMimeTypes: [PAGE_ATTACHMENT_STORAGE_MIME],
  };
}

function bucketMatches(bucket) {
  return bucket.public === false && bucket.file_size_limit === PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT && Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.length === 1 && bucket.allowed_mime_types[0] === PAGE_ATTACHMENT_STORAGE_MIME;
}

async function ensureBucket(supabase) {
  const { data, error } = await supabase.storage.getBucket(PAGE_ATTACHMENT_STORAGE_BUCKET);
  if (error?.status === 404 || error?.statusCode === "404") {
    const { error: createError } = await supabase.storage.createBucket(PAGE_ATTACHMENT_STORAGE_BUCKET, bucketOptions());
    if (createError) throw createError;
    return "created";
  }
  if (error) throw error;
  if (!bucketMatches(data)) {
    const { error: updateError } = await supabase.storage.updateBucket(PAGE_ATTACHMENT_STORAGE_BUCKET, bucketOptions());
    if (updateError) throw updateError;
    return "updated";
  }
  return "unchanged";
}

function moodmodeZip() {
  const bytes = new Uint8Array(readFileSync(resolve(assetDirectory, `${moodmodeAssetId}-${moodmodeFilename}`)));
  if (moodmodeBytes > PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT || bytes.byteLength !== moodmodeBytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new Error("moodmode ZIP 무결성 검증에 실패했습니다.");
  }
  return bytes;
}

function moodmodeObjectPaths() {
  const paths = [localUser, productionUser].map((userId) => createPageAttachmentObjectPath(
    userId,
    PAGE_ATTACHMENT_MOODMODE_SOURCE_ID,
    PAGE_ATTACHMENT_MOODMODE_FILENAME
  ));
  if (paths.some((path) => !path)) throw new Error("moodmode ZIP Storage 경로 검증에 실패했습니다.");
  return paths;
}

async function uploadMoodmode(supabase) {
  const bytes = moodmodeZip();
  for (const path of moodmodeObjectPaths()) {
    const { error } = await supabase.storage.from(PAGE_ATTACHMENT_STORAGE_BUCKET).upload(path, bytes, {
      contentType: PAGE_ATTACHMENT_STORAGE_MIME,
      upsert: true,
    });
    if (error) throw error;
  }
  return 2;
}

async function importProduction(supabase) {
  const rows = await allRows(supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser));
  assertKimhyoComplete(rows);
  const plans = plansFor(rows);
  const result = { inserted: 0, updated: 0, skipped: 0 };
  for (const { record, action, row } of plans) {
    if (action === "insert") {
      const now = new Date().toISOString();
      const { error } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: record.title, content: record.content, created_at: now, updated_at: now });
      if (error) throw error;
      result.inserted += 1;
    } else if (action === "update") {
      const { error } = await supabase.from("custom_pages").update({ content: record.content, updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", productionUser);
      if (error) throw error;
      result.updated += 1;
    } else {
      result.skipped += 1;
    }
  }
  return result;
}

if (process.argv.includes("--check")) {
  const zip = moodmodeZip();
  const attachmentPaths = moodmodeObjectPaths();
  console.log(JSON.stringify({
    pages: records.map((record) => ({ title: record.title, images: record.imageSources.length, attachments: record.attachments.length })),
    pagesTotal: records.length + 1,
    writeCandidates: records.length,
    existingCompleteCandidates: 1,
    existingComplete: kimhyoExpected,
    images: totalImages,
    attachments: totalAttachments,
    attachmentPaths,
    zipBytes: zip.byteLength,
    writes: 0,
  }, null, 2));
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const localPreflightRows = localRows();
plansFor(localPreflightRows);
assertKimhyoComplete(localPreflightRows);
const productionPreflightRows = await allRows(supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser));
plansFor(productionPreflightRows);
assertKimhyoComplete(productionPreflightRows);
const bucket = await ensureBucket(supabase);
const uploads = await uploadMoodmode(supabase);
const local = importLocal();
const production = await importProduction(supabase);
const localDb = new Database(resolve(root, "data/mymark.db"), { readonly: true });
const localVerify = verifyRows(localDb.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser));
localDb.close();
const productionVerify = verifyRows(await allRows(supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser)));
console.log(JSON.stringify({ bucket, uploads, local, production, verify: { local: localVerify, production: productionVerify } }, null, 2));
