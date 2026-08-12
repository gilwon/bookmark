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
  const imageCount = content.match(/"type":"image"/g)?.length ?? 0;
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
