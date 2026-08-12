// Pages 첨부 다운로드의 안전한 Storage 경로를 만든다
import { pdfUserFolder } from "@/lib/pdf-storage";

export const PAGE_ATTACHMENT_STORAGE_BUCKET = "page-attachments";
export const PAGE_ATTACHMENT_STORAGE_MIME = "application/zip";
export const PAGE_ATTACHMENT_SOURCE_ID = "5a5b256827ac8287b9b381e50f142820";
export const PAGE_ATTACHMENT_FILENAMES = [
  "intranet-style-skill-20260807.zip",
  "ui-inspector-skill-20260807.zip",
] as const;

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
