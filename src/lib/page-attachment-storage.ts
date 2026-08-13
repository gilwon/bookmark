// Pages 첨부 다운로드의 안전한 Storage 경로를 만든다
import { pdfUserFolder } from "@/lib/pdf-storage";

export const PAGE_ATTACHMENT_STORAGE_BUCKET = "page-attachments";
export const PAGE_ATTACHMENT_STORAGE_MIME = "application/zip";
export const PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT = 12 * 1024 * 1024;
export const PAGE_ATTACHMENT_SOURCE_ID = "5a5b256827ac8287b9b381e50f142820";
export const PAGE_ATTACHMENT_FILENAMES = [
  "intranet-style-skill-20260807.zip",
  "ui-inspector-skill-20260807.zip",
] as const;
export const PAGE_ATTACHMENT_MOODMODE_SOURCE_ID = "0e7b256827ac82de8fce8194c7e6a4c7";
export const PAGE_ATTACHMENT_MOODMODE_FILENAME = "moodmode-insta-saver.zip";

type PageAttachmentImportRow = { title: unknown; content: unknown };

type PageAttachmentStorageError = {
  status?: number;
  statusCode?: string;
};

function normalizedNotionWeekTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR");
}

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian = false): number {
  if (offset + 4 > bytes.length) return -1;
  if (littleEndian) return (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24) >>> 0;
  return (bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function isPngImageBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 45 || !hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return false;
  let offset = 8;
  let foundImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = bytes.slice(offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) return false;
    if (offset === 8 && (length !== 13 || !hasBytes(type, 0, [0x49, 0x48, 0x44, 0x52]))) return false;
    if (hasBytes(type, 0, [0x49, 0x44, 0x41, 0x54])) foundImageData = true;
    if (hasBytes(type, 0, [0x49, 0x45, 0x4e, 0x44])) {
      return foundImageData && length === 0 && end === bytes.length && hasBytes(bytes, offset, [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    }
    offset = end;
  }
  return false;
}

function isJpegImageBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 128 || !hasBytes(bytes, 0, [0xff, 0xd8]) || !hasBytes(bytes, bytes.length - 2, [0xff, 0xd9])) return false;
  let offset = 2;
  let foundSof = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0 || marker === 0xd9) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return false;
    const length = (bytes[offset] << 8) + bytes[offset + 1];
    const end = offset + length;
    if (length < 2 || end > bytes.length - 2) return false;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) foundSof = true;
    if (marker === 0xda) return foundSof && end < bytes.length - 2;
    offset = end;
  }
  return false;
}

function isWebpImageBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || !hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) || !hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50]) || readUint32(bytes, 4, true) + 8 !== bytes.length) return false;
  let offset = 12;
  let foundImageChunk = false;
  while (offset + 8 <= bytes.length) {
    const type = bytes.slice(offset, offset + 4);
    const length = readUint32(bytes, offset + 4, true);
    const end = offset + 8 + length;
    if (end > bytes.length) return false;
    if (hasBytes(type, 0, [0x56, 0x50, 0x38, 0x20]) || hasBytes(type, 0, [0x56, 0x50, 0x38, 0x4c]) || hasBytes(type, 0, [0x56, 0x50, 0x38, 0x58])) foundImageChunk = true;
    offset = end + length % 2;
  }
  return foundImageChunk && offset === bytes.length;
}

function isDisplayablePageImageSource(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!match || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(match[2])) return false;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
    if (match[1] === "png") return isPngImageBytes(bytes);
    if (match[1] === "jpeg") return isJpegImageBytes(bytes);
    return isWebpImageBytes(bytes);
  } catch {
    return false;
  }
}

/** 저장한 TipTap 문서에서 실제로 표시할 수 있는 이미지를 센다. */
export function countDisplayablePageImages(content: unknown): number {
  let document: unknown;
  try {
    document = JSON.parse(String(content));
  } catch {
    return 0;
  }
  let count = 0;
  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    const item = node as { type?: unknown; attrs?: { src?: unknown }; content?: unknown[] };
    if (item.type === "image" && isDisplayablePageImageSource(item.attrs?.src)) count += 1;
    for (const child of item.content ?? []) visit(child);
  }
  visit(document);
  return count;
}

/** 이관한 Pages 첨부의 원문 sourceId인지 확인한다. */
export function isPageAttachmentSourceId(value: unknown): value is string {
  return value === PAGE_ATTACHMENT_SOURCE_ID || value === PAGE_ATTACHMENT_MOODMODE_SOURCE_ID;
}

/** 허용된 Pages ZIP 첨부 파일명인지 확인한다. */
export function isPageAttachmentFilename(value: unknown): value is string {
  return typeof value === "string" && (
    PAGE_ATTACHMENT_FILENAMES.includes(value as (typeof PAGE_ATTACHMENT_FILENAMES)[number]) ||
    value === PAGE_ATTACHMENT_MOODMODE_FILENAME
  );
}

/** 사용자가 소유한 Pages ZIP 첨부의 결정적 Storage 경로를 만든다. */
export function createPageAttachmentObjectPath(
  userId: string,
  sourceId: string,
  filename: string
): string | null {
  const isKimhyoFile = sourceId === PAGE_ATTACHMENT_SOURCE_ID && PAGE_ATTACHMENT_FILENAMES.includes(
    filename as (typeof PAGE_ATTACHMENT_FILENAMES)[number]
  );
  const isMoodmodeFile = sourceId === PAGE_ATTACHMENT_MOODMODE_SOURCE_ID && filename === PAGE_ATTACHMENT_MOODMODE_FILENAME;
  if (!isKimhyoFile && !isMoodmodeFile) {
    return null;
  }
  return `${pdfUserFolder(userId)}/${sourceId}/${filename}`;
}

/** 기존 Page 행과 기대 미디어를 비교해 안전한 이관 동작을 정한다. */
export function planNotionWeekPageAction<T extends PageAttachmentImportRow>(
  rows: readonly T[],
  title: string,
  sourceMarkers: readonly string[],
  expectedImages: number,
  attachmentUrls: readonly string[]
): { action: "insert"; row: null } | { action: "update" | "skip"; row: T } {
  const normalizedTitle = normalizedNotionWeekTitle(title);
  const exactTitles = rows.filter((row) => normalizedNotionWeekTitle(row.title) === normalizedTitle);
  if (exactTitles.length > 1) {
    throw new Error("Notion Page 제목이 중복되어 저장을 중단했습니다.");
  }
  if (exactTitles.length === 0) {
    if (rows.some((row) => sourceMarkers.some((marker) => String(row.content).includes(marker)))) {
      throw new Error("Notion Page 원문 식별자만 일치하는 문서가 있어 저장을 중단했습니다.");
    }
    return { action: "insert", row: null };
  }
  const row = exactTitles[0];
  const content = String(row.content);
  const sourceRows = rows.filter((candidate) => sourceMarkers.some((marker) => String(candidate.content).includes(marker)));
  if (sourceRows.length !== 1 || sourceRows[0] !== row) {
    throw new Error("Notion Page 제목과 원문 식별자 후보가 달라 저장을 중단했습니다.");
  }
  const imageCount = countDisplayablePageImages(content);
  const mediaMissing = imageCount < expectedImages || attachmentUrls.some((url) => !content.includes(url));
  return { action: mediaMissing ? "update" : "skip", row };
}

/** 정확한 제목만 갱신 대상으로 고르고 모호한 원문 후보는 중단한다. */
export function selectPageAttachmentImportTarget<T extends PageAttachmentImportRow>(
  rows: readonly T[],
  title: string,
  sourceMarkers: readonly string[]
): T | null {
  const exactTitles = rows.filter((row) => row.title === title);
  if (exactTitles.length > 1) {
    throw new Error("김효율 스킬팩 제목이 중복되어 저장을 중단했습니다.");
  }
  if (exactTitles.length === 1) return exactTitles[0];
  if (rows.some((row) => sourceMarkers.some((marker) => String(row.content).includes(marker)))) {
    throw new Error("김효율 스킬팩 원문 식별자만 일치하는 문서가 있어 저장을 중단했습니다.");
  }
  return null;
}

/** Storage 결과를 다운로드 응답 상태와 서명 URL로 바꾼다. */
export function pageAttachmentDownloadOutcome(
  error: PageAttachmentStorageError | null,
  signedUrl: unknown
): { status: 404 } | { status: 500 } | { status: 307; signedUrl: string } {
  if (error?.status === 404 || error?.statusCode === "404") return { status: 404 };
  if (error || typeof signedUrl !== "string" || !signedUrl) return { status: 500 };
  return { status: 307, signedUrl };
}
