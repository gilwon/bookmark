// 텍스트 PDF → 마크다운 초안 (클라이언트 pdf.js, OCR 없음)

export type PdfExtractResult = {
  title: string;
  markdown: string;
  pageCount: number;
  charCount: number;
  /** 추출 문자가 매우 적으면 스캔본 가능성 */
  likelyScanned: boolean;
};

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_PAGES = 200;

type TextItemLike = {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
};

/**
 * pdf.js TextItem 배열을 줄 단위 텍스트로 합친다.
 * y 좌표로 줄을 묶고, 같은 줄은 x 순 정렬.
 */
function textItemsToLines(items: TextItemLike[]): string {
  type Line = { y: number; parts: { x: number; str: string }[] };
  const lines: Line[] = [];

  for (const item of items) {
    const str = item.str ?? "";
    if (!str && !item.hasEOL) continue;
    const tr = item.transform;
    const x = tr?.[4] ?? 0;
    const y = Math.round(tr?.[5] ?? 0);

    let line = lines.find((l) => Math.abs(l.y - y) <= 2);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    if (str) line.parts.push({ x, str });
    if (item.hasEOL) {
      // 강제 줄바꿈 마커 — 다음 아이템이 새 줄로 가도록 y 를 살짝 어긋냄
      lines.push({ y: y - 0.5, parts: [] });
    }
  }

  // PDF 좌표는 위로 증가 → 위에서 아래로 읽으려면 y 내림차순
  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((l) =>
      l.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join("")
        .replace(/[ \t]+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n");
}

/** 파일명에서 확장자 제거한 제목 */
export function titleFromPdfName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").trim() || "PDF 가져오기";
}

/**
 * PDF 바이트에서 텍스트를 추출해 마크다운 초안을 만든다.
 * 브라우저 전용 (pdfjs worker). 스캔 PDF 는 거의 빈 문자열이 된다.
 */
export async function extractPdfToMarkdown(
  data: ArrayBuffer,
  fileName: string
): Promise<PdfExtractResult> {
  if (data.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF 가 너무 큽니다 (최대 ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)}MB).`
    );
  }

  // SSR 방지 — 동적 import
  const pdfjs = await import("pdfjs-dist");
  const { getDocument, GlobalWorkerOptions, version } = pdfjs;

  // Next/Webpack 에서 worker 경로 안정화 (CDN)
  if (typeof window !== "undefined") {
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }

  const loadingTask = getDocument({
    data: new Uint8Array(data),
    // 폰트 없어도 텍스트 추출은 가능
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  if (pageCount > MAX_PAGES) {
    throw new Error(`페이지 수가 너무 많습니다 (최대 ${MAX_PAGES}페이지).`);
  }

  const pageBlocks: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as TextItemLike[];
    const text = textItemsToLines(items);
    if (text.trim()) {
      pageBlocks.push(text.trim());
    }
  }

  const body = pageBlocks.join("\n\n");
  const title = titleFromPdfName(fileName);
  const charCount = body.replace(/\s/g, "").length;
  const likelyScanned = pageCount > 0 && charCount < Math.max(20, pageCount * 8);

  let markdown: string;
  if (!body.trim()) {
    markdown =
      `_이 PDF 에서 추출된 텍스트가 없습니다. 스캔(이미지) PDF 이거나 보호된 파일일 수 있습니다._\n\n` +
      `원본 파일: \`${fileName}\``;
  } else if (pageCount === 1) {
    markdown = body;
  } else {
    // 페이지 구분이 보이도록 단순 구분
    markdown = pageBlocks
      .map((block, idx) => `## ${idx + 1}페이지\n\n${block}`)
      .join("\n\n");
  }

  return {
    title,
    markdown,
    pageCount,
    charCount,
    likelyScanned,
  };
}

export { MAX_PDF_BYTES };
