// PDF Storage의 업로드 제한과 소유 경로 입력을 검증한다
export const PDF_STORAGE_BUCKET = "pdf-files";
export const PDF_STORAGE_MIME = "application/pdf";
export const MAX_PDF_STORAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_ORIGINAL_NAME_BYTES = 255;

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0))
    );
  } catch {
    return null;
  }
}

function isValidOriginalName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    /\.pdf$/i.test(value) &&
    new TextEncoder().encode(value).byteLength <= MAX_PDF_ORIGINAL_NAME_BYTES
  );
}

/** 클라이언트가 보낸 PDF 메타를 검증하고 오류 문구를 반환한다. */
export function validatePdfUploadMeta(value: unknown): string | null {
  if (!value || typeof value !== "object") return "PDF 파일 정보가 올바르지 않습니다.";
  const { name, type, size } = value as Record<string, unknown>;
  if (
    !isValidOriginalName(name) ||
    type !== PDF_STORAGE_MIME
  ) {
    return typeof name === "string" && /\.pdf$/i.test(name)
      ? "PDF 파일명은 UTF-8 기준 255바이트 이하여야 합니다."
      : "PDF 파일만 업로드할 수 있습니다.";
  }
  if (
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size <= 0
  ) {
    return "PDF 파일 크기가 올바르지 않습니다.";
  }
  if (size > MAX_PDF_STORAGE_BYTES) {
    return "PDF 파일은 최대 20MB까지 저장할 수 있습니다.";
  }
  return null;
}

/** 서버가 생성한 UUID v4인지 확인한다. */
export function isPdfStorageId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

/** Auth.js 사용자 ID를 Storage 경로에 안전한 base64url 폴더 키로 바꾼다. */
export function pdfUserFolder(userId: string): string {
  return encodeBase64Url(userId);
}

/** 서버 UUID와 원본 파일명을 경로 안전한 Storage object name으로 만든다. */
export function createPdfObjectName(id: string, name: string): string | null {
  if (!isPdfStorageId(id) || !isValidOriginalName(name)) return null;
  return `${id}--${encodeBase64Url(name)}`;
}

/** Storage object name에서 서버 UUID와 원본 파일명을 복원한다. */
export function parsePdfObjectName(
  objectName: string
): { id: string; name: string } | null {
  const match = objectName.match(/^([0-9a-f-]{36})--([A-Za-z0-9_-]+)$/i);
  if (!match || !isPdfStorageId(match[1])) return null;
  const name = decodeBase64Url(match[2]);
  if (!name || createPdfObjectName(match[1], name) !== objectName) return null;
  return { id: match[1], name };
}
