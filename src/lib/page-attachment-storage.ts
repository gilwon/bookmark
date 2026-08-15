// Pages 첨부 다운로드의 안전한 Storage 경로를 만든다
import { pdfUserFolder } from "@/lib/pdf-storage";
import { removeDuplicateLeadingTitle } from "@/lib/migrate-aside-content";

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
export const PAGE_ATTACHMENT_CLAUDE_SETUP_SOURCE_ID = "3bb3de874c4d80189cf4f2c0599b9296";
export const PAGE_ATTACHMENT_CLAUDE_SETUP_FILENAME = "방구석-클로드코드-세팅팩.zip";

type PageAttachmentImportRow = { title: unknown; content: unknown };

type PageAttachmentStorageError = {
  status?: number;
  statusCode?: string;
};

export function normalizedNotionWeekTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR");
}

/** 저장한 TipTap 문서에서 이미지 source와 link mark href를 읽는다. */
export function extractPageMediaReferences(content: unknown): { imageSources: string[]; linkHrefs: string[] } {
  let document: unknown;
  try {
    document = JSON.parse(String(content));
  } catch {
    return { imageSources: [], linkHrefs: [] };
  }
  const imageSources: string[] = [];
  const linkHrefs: string[] = [];
  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    const item = node as {
      type?: unknown;
      attrs?: { src?: unknown };
      marks?: unknown[];
      content?: unknown[];
    };
    if (item.type === "image" && typeof item.attrs?.src === "string") imageSources.push(item.attrs.src);
    for (const mark of item.marks ?? []) {
      if (!mark || typeof mark !== "object") continue;
      const link = mark as { type?: unknown; attrs?: { href?: unknown } };
      if (link.type === "link" && typeof link.attrs?.href === "string") linkHrefs.push(link.attrs.href);
    }
    for (const child of item.content ?? []) visit(child);
  }
  visit(document);
  return { imageSources, linkHrefs };
}

/** 이관한 Pages 첨부의 원문 sourceId인지 확인한다. */
export function isPageAttachmentSourceId(value: unknown): value is string {
  return value === PAGE_ATTACHMENT_SOURCE_ID || value === PAGE_ATTACHMENT_MOODMODE_SOURCE_ID || value === PAGE_ATTACHMENT_CLAUDE_SETUP_SOURCE_ID;
}

/** 허용된 Pages ZIP 첨부 파일명인지 확인한다. */
export function isPageAttachmentFilename(value: unknown): value is string {
  return typeof value === "string" && (
    PAGE_ATTACHMENT_FILENAMES.includes(value as (typeof PAGE_ATTACHMENT_FILENAMES)[number]) ||
    value === PAGE_ATTACHMENT_MOODMODE_FILENAME ||
    value === PAGE_ATTACHMENT_CLAUDE_SETUP_FILENAME
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
  const isClaudeSetupFile = sourceId === PAGE_ATTACHMENT_CLAUDE_SETUP_SOURCE_ID && filename === PAGE_ATTACHMENT_CLAUDE_SETUP_FILENAME;
  if (!isKimhyoFile && !isMoodmodeFile && !isClaudeSetupFile) {
    return null;
  }
  return `${pdfUserFolder(userId)}/${sourceId}/${filename}`;
}

/** 기존 Page 행과 기대 미디어를 비교해 안전한 이관 동작을 정한다. */
export function planNotionWeekPageAction<T extends PageAttachmentImportRow>(
  rows: readonly T[],
  title: string,
  sourceMarkers: readonly string[],
  expectedImageSources: readonly string[],
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
  const mediaReferences = extractPageMediaReferences(content);
  const mediaMissing = expectedImageSources.some((source) => !mediaReferences.imageSources.includes(source)) || attachmentUrls.some((url) => !mediaReferences.linkHrefs.includes(url));
  return { action: mediaMissing ? "update" : "skip", row };
}

function editorCanonicalNode(value: unknown, omittedLinkHrefs: readonly string[]): unknown {
  if (Array.isArray(value)) {
    const nodes: Record<string, unknown>[] = [];
    for (const item of value) {
      const node = editorCanonicalNode(item, omittedLinkHrefs);
      if (!node || typeof node !== "object" || Array.isArray(node)) continue;
      const current = node as Record<string, unknown>;
      const previous = nodes.at(-1);
      if (
        previous?.type === "text" &&
        current.type === "text" &&
        JSON.stringify(previous.marks ?? []) === JSON.stringify(current.marks ?? []) &&
        JSON.stringify(previous.attrs ?? {}) === JSON.stringify(current.attrs ?? {})
      ) {
        previous.text = `${String(previous.text ?? "")}${String(current.text ?? "")}`;
      } else {
        nodes.push(current);
      }
    }
    return nodes;
  }
  if (!value || typeof value !== "object") return value;
  const node = { ...(value as Record<string, unknown>) };
  if (
    node.type === "text" &&
    Array.isArray(node.marks) &&
    node.marks.some((mark) => {
      if (!mark || typeof mark !== "object") return false;
      const link = mark as { type?: unknown; attrs?: { href?: unknown } };
      return link.type === "link" && typeof link.attrs?.href === "string" && omittedLinkHrefs.includes(link.attrs.href);
    })
  ) {
    return undefined;
  }
  if (node.type === "link" && node.attrs && typeof node.attrs === "object") {
    const attrs = { ...(node.attrs as Record<string, unknown>) };
    if (attrs.target === "_blank") delete attrs.target;
    if (attrs.rel === "noopener noreferrer nofollow") delete attrs.rel;
    if (attrs.class === "text-indigo-500 underline underline-offset-2") delete attrs.class;
    if (attrs.title === null) delete attrs.title;
    node.attrs = attrs;
  }
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(node).sort()) output[key] = editorCanonicalNode(node[key], omittedLinkHrefs);
  if (output.type === "paragraph" && Array.isArray(output.content) && output.content.length === 0) return undefined;
  return output;
}

function canonicalPageContent(content: unknown, title: string, omittedLinkHrefs: readonly string[] = []): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(content));
  } catch {
    throw new Error("Page 본문 JSON이 올바르지 않아 저장을 중단했습니다.");
  }
  return JSON.stringify(editorCanonicalNode(removeDuplicateLeadingTitle(parsed, title).content, omittedLinkHrefs));
}

/** 편집기 정규화 외의 본문 차이는 덮어쓰지 않고 첨부 결손만 갱신한다. */
export function planExactPageAttachmentAction<T extends PageAttachmentImportRow>(
  rows: readonly T[],
  title: string,
  sourceMarkers: readonly string[],
  expectedContent: unknown,
  attachmentUrls: readonly string[]
): { action: "insert"; row: null } | { action: "update" | "skip"; row: T } {
  const mediaPlan = planNotionWeekPageAction(rows, title, sourceMarkers, [], attachmentUrls);
  if (mediaPlan.action === "insert") return mediaPlan;
  if (canonicalPageContent(mediaPlan.row.content, title) === canonicalPageContent(expectedContent, title)) {
    return { action: "skip", row: mediaPlan.row };
  }
  const media = extractPageMediaReferences(mediaPlan.row.content);
  const attachmentMissing = attachmentUrls.some((url) => !media.linkHrefs.includes(url));
  if (
    attachmentMissing &&
    canonicalPageContent(mediaPlan.row.content, title, attachmentUrls) === canonicalPageContent(expectedContent, title, attachmentUrls)
  ) {
    return { action: "update", row: mediaPlan.row };
  }
  throw new Error("기존 Page 본문이 달라 덮어쓰지 않고 중단했습니다.");
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
