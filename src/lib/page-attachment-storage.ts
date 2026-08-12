// Pages 첨부 다운로드의 안전한 Storage 경로를 만든다
import { pdfUserFolder } from "@/lib/pdf-storage";

export const PAGE_ATTACHMENT_STORAGE_BUCKET = "page-attachments";
export const PAGE_ATTACHMENT_STORAGE_MIME = "application/zip";
export const PAGE_ATTACHMENT_SOURCE_ID = "5a5b256827ac8287b9b381e50f142820";
export const PAGE_ATTACHMENT_FILENAMES = [
  "intranet-style-skill-20260807.zip",
  "ui-inspector-skill-20260807.zip",
] as const;

type PageAttachmentImportRow = { title: unknown; content: unknown };

type PageAttachmentStorageError = {
  status?: number;
  statusCode?: string;
};

/** 이관한 Pages 첨부의 원문 sourceId인지 확인한다. */
export function isPageAttachmentSourceId(value: unknown): value is string {
  return value === PAGE_ATTACHMENT_SOURCE_ID;
}

/** 허용된 Pages ZIP 첨부 파일명인지 확인한다. */
export function isPageAttachmentFilename(value: unknown): value is string {
  return typeof value === "string" && PAGE_ATTACHMENT_FILENAMES.includes(
    value as (typeof PAGE_ATTACHMENT_FILENAMES)[number]
  );
}

/** 사용자가 소유한 Pages ZIP 첨부의 결정적 Storage 경로를 만든다. */
export function createPageAttachmentObjectPath(
  userId: string,
  sourceId: string,
  filename: string
): string | null {
  if (!isPageAttachmentSourceId(sourceId) || !isPageAttachmentFilename(filename)) {
    return null;
  }
  return `${pdfUserFolder(userId)}/${sourceId}/${filename}`;
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
