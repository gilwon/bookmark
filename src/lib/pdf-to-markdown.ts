// 텍스트 PDF → 가독성 있는 마크다운 초안 (클라이언트 pdf.js, OCR 없음)

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
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

/** 한 줄 기하 정보 */
type LineGeom = {
  y: number;
  x0: number;
  x1: number;
  height: number;
  text: string;
};

/** 페이지 하나에서 뽑은 줄들 */
type PageLines = {
  pageIndex: number; // 0-based
  lines: LineGeom[];
  pageHeight: number;
};

// --- 줄 재구성 -----------------------------------------------------------

/**
 * pdf.js 아이템 → 줄 목록.
 * - y 로 줄 묶기
 * - x 로 정렬 후, 아이템 사이 간격이 있으면 공백 삽입
 */
function itemsToLineGeoms(items: TextItemLike[]): LineGeom[] {
  type Part = { x: number; w: number; h: number; str: string };
  type Bucket = { y: number; parts: Part[] };
  const buckets: Bucket[] = [];

  for (const item of items) {
    const str = item.str ?? "";
    if (!str) continue;
    const tr = item.transform;
    if (!tr || tr.length < 6) continue;

    const x = tr[4] ?? 0;
    const y = tr[5] ?? 0;
    // 폰트 크기 근사 (scaleY 또는 scaleX)
    const h =
      Math.abs(tr[3] ?? 0) ||
      Math.abs(tr[0] ?? 0) ||
      item.height ||
      10;
    const w =
      typeof item.width === "number" && item.width > 0
        ? item.width
        : Math.max(str.length * h * 0.45, h * 0.3);

    // 같은 줄: y 차이가 글자 높이의 ~35% 이내
    const tol = Math.max(h * 0.35, 2);
    let bucket = buckets.find((b) => Math.abs(b.y - y) <= tol);
    if (!bucket) {
      bucket = { y, parts: [] };
      buckets.push(bucket);
    } else {
      // 대표 y 를 가중 평균에 가깝게 유지
      bucket.y = (bucket.y * bucket.parts.length + y) / (bucket.parts.length + 1);
    }
    bucket.parts.push({ x, w, h, str });
  }

  // 위에서 아래로 (PDF y 는 위로 증가)
  buckets.sort((a, b) => b.y - a.y);

  return buckets
    .map((b) => {
      const parts = b.parts.sort((a, c) => a.x - c.x);
      if (parts.length === 0) return null;

      let text = "";
      let prevEnd = -Infinity;
      let maxH = 0;
      for (const p of parts) {
        maxH = Math.max(maxH, p.h);
        // 이전 글자 끝과 현재 시작 사이가 넓으면 공백
        if (text.length > 0 && p.x > prevEnd + Math.max(p.h * 0.12, 0.8)) {
          if (!/\s$/.test(text) && !/^\s/.test(p.str)) {
            text += " ";
          }
        }
        text += p.str;
        prevEnd = p.x + p.w;
      }

      text = text.replace(/[ \t]+/g, " ").trim();
      if (!text) return null;

      return {
        y: b.y,
        x0: parts[0]!.x,
        x1: prevEnd,
        height: maxH,
        text,
      } satisfies LineGeom;
    })
    .filter((l): l is LineGeom => l != null);
}

// --- 문단 재배치 ---------------------------------------------------------

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** 문장 끝으로 보이는지 */
function endsSentence(s: string): boolean {
  return /[.!?…。．！？:：;；」』）)\]]\s*$/.test(s.trim());
}

/** 목록 줄 */
function isListLine(s: string): boolean {
  return /^(?:[-*•●○▪▸►·]|\d+[.)]|[a-zA-Z][.)]|[가-힣]\))\s+/.test(
    s.trim()
  );
}

/** 제목 후보 (짧은 줄, 큰 글씨, 또는 짧은 전각/강조) */
function isHeadingCandidate(
  line: LineGeom,
  bodyHeight: number,
  next?: LineGeom
): boolean {
  const t = line.text.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (isListLine(t)) return false;
  // 본문보다 확실히 큰 글씨
  if (bodyHeight > 0 && line.height >= bodyHeight * 1.25) return true;
  // 짧은 줄 + 다음 줄과 간격이 크면 소제목
  if (t.length <= 40 && !endsSentence(t) && next) {
    const gap = line.y - next.y;
    if (gap > line.height * 1.8) return true;
  }
  // ALL CAPS 짧은 영문
  if (t.length <= 48 && /^[A-Z0-9][A-Z0-9\s\-/&:]+$/.test(t) && t.length > 3) {
    return true;
  }
  return false;
}

/**
 * 줄 배열 → 문단/제목/목록 블록 문자열 배열.
 * soft wrap 은 공백으로 이어 붙이고, 큰 간격은 문단 분리.
 */
function reflowLinesToBlocks(
  lines: LineGeom[],
  pageHeight: number
): string[] {
  if (lines.length === 0) return [];

  const heights = lines.map((l) => l.height).filter((h) => h > 0);
  const bodyHeight = median(heights) || 12;

  // 페이지 상·하단 10% 근처의 짧은 반복 헤더/푸터 후보 제거
  const filtered = lines.filter((l) => {
    const topBand = pageHeight > 0 && l.y > pageHeight * 0.92;
    const botBand = pageHeight > 0 && l.y < pageHeight * 0.06;
    if ((topBand || botBand) && l.text.length <= 40) {
      // 순수 페이지 번호
      if (/^(?:\d+|[ivxlcdm]+|page\s*\d+)$/i.test(l.text.trim())) {
        return false;
      }
    }
    return true;
  });

  const blocks: string[] = [];
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    let p = paraBuf.join(" ");
    // 하이픈 줄바꿈 복원: "exam- ple" → "example"
    p = p.replace(/(\w)-\s+(\w)/g, "$1$2");
    // 연속 공백
    p = p.replace(/[ \t]{2,}/g, " ").trim();
    if (p) blocks.push(p);
    paraBuf = [];
  };

  for (let i = 0; i < filtered.length; i++) {
    const line = filtered[i]!;
    const next = filtered[i + 1];
    const t = line.text.trim();
    if (!t) continue;

    // 목록
    if (isListLine(t)) {
      flushPara();
      // 마커 정규화
      const normalized = t
        .replace(/^[•●○▪▸►·]\s+/, "- ")
        .replace(/^[-*]\s+/, "- ");
      blocks.push(normalized);
      continue;
    }

    // 제목
    if (isHeadingCandidate(line, bodyHeight, next)) {
      flushPara();
      // # 개수: 더 크면 h2, 비슷하면 h3
      const level =
        bodyHeight > 0 && line.height >= bodyHeight * 1.45 ? 2 : 3;
      const hashes = "#".repeat(level);
      blocks.push(`${hashes} ${t.replace(/^#+\s*/, "")}`);
      continue;
    }

    // 문단 이어붙이기
    paraBuf.push(t);

    if (!next) {
      flushPara();
      continue;
    }

    // 다음 줄과의 수직 간격 (PDF y 내림)
    const gap = line.y - next.y;
    const softGap = bodyHeight * 1.55;
    const hardGap = bodyHeight * 2.2;

    // 다음이 목록/제목이면 문단 종료
    if (isListLine(next.text) || isHeadingCandidate(next, bodyHeight, filtered[i + 2])) {
      flushPara();
      continue;
    }

    // 큰 간격 → 문단 끝
    if (gap > hardGap) {
      flushPara();
      continue;
    }

    // 문장 끝났고 중간 이상 간격 → 문단 끝
    if (endsSentence(t) && gap > softGap) {
      flushPara();
      continue;
    }

    // 그 외: soft wrap (같은 문단)
    // 들여쓰기 큰 변화 + 문장 끝 → 새 문단
    if (endsSentence(t) && next.x0 > line.x0 + bodyHeight * 1.5) {
      flushPara();
    }
  }

  flushPara();
  return blocks;
}

/**
 * 페이지 경계에서 잘린 문단을 이어 붙인다.
 * (이전 블록이 문장 끝이 아니고, 다음이 제목/목록이 아니면 merge)
 */
function mergeAcrossPages(pageBlockLists: string[][]): string[] {
  const out: string[] = [];
  for (const blocks of pageBlockLists) {
    if (blocks.length === 0) continue;
    if (out.length === 0) {
      out.push(...blocks);
      continue;
    }

    const prev = out[out.length - 1]!;
    const first = blocks[0]!;

    const prevIsHeading = /^#{1,6}\s/.test(prev);
    const firstIsHeading = /^#{1,6}\s/.test(first);
    const firstIsList = isListLine(first);
    const prevIsList = isListLine(prev);

    if (
      !prevIsHeading &&
      !firstIsHeading &&
      !firstIsList &&
      !prevIsList &&
      !endsSentence(prev) &&
      // 다음이 소문자/한글 이면 이어짐 가능성 높음
      /^[a-z가-힣(]/.test(first.trim())
    ) {
      // 하이픈 연결 포함 merge
      let merged = `${prev} ${first}`;
      merged = merged.replace(/(\w)-\s+(\w)/g, "$1$2");
      merged = merged.replace(/[ \t]{2,}/g, " ").trim();
      out[out.length - 1] = merged;
      out.push(...blocks.slice(1));
    } else {
      out.push(...blocks);
    }
  }
  return out;
}

/** 블록 배열 → 마크다운 문서 */
function blocksToMarkdown(blocks: string[]): string {
  if (blocks.length === 0) return "";

  const parts: string[] = [];
  let listBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length === 0) return;
    parts.push(listBuf.join("\n"));
    listBuf = [];
  };

  for (const b of blocks) {
    if (isListLine(b) || /^-\s+/.test(b)) {
      listBuf.push(b.startsWith("- ") ? b : b.replace(/^\s+/, ""));
      continue;
    }
    flushList();
    if (/^#{1,6}\s/.test(b)) {
      parts.push(b);
    } else {
      parts.push(b);
    }
  }
  flushList();

  // 블록 사이 빈 줄 (목록 내부는 이미 \n 만)
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 파일명에서 확장자 제거한 제목 */
export function titleFromPdfName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").trim() || "PDF 가져오기";
}

/**
 * PDF 바이트에서 텍스트를 추출하고 문단 단위로 재배치한 마크다운을 만든다.
 * 브라우저 전용 (pdfjs worker).
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

  const pdfjs = await import("pdfjs-dist");
  const { getDocument, GlobalWorkerOptions, version } = pdfjs;

  if (typeof window !== "undefined") {
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }

  const loadingTask = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  if (pageCount > MAX_PAGES) {
    throw new Error(`페이지 수가 너무 많습니다 (최대 ${MAX_PAGES}페이지).`);
  }

  const pages: PageLines[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent({
      // 공백 아이템 포함 — 단어 간격 추정에 도움
      includeMarkedContent: false,
    });
    const items = content.items as TextItemLike[];
    const lines = itemsToLineGeoms(items);
    pages.push({
      pageIndex: i - 1,
      lines,
      pageHeight: viewport.height,
    });
  }

  // 페이지별 문단화 → 페이지 경계 merge
  const pageBlocks = pages.map((p) =>
    reflowLinesToBlocks(p.lines, p.pageHeight)
  );
  const merged = mergeAcrossPages(pageBlocks);
  let markdown = blocksToMarkdown(merged);

  const title = titleFromPdfName(fileName);
  const charCount = markdown.replace(/\s/g, "").length;
  const likelyScanned =
    pageCount > 0 && charCount < Math.max(20, pageCount * 8);

  if (!markdown.trim()) {
    markdown =
      `_이 PDF 에서 추출된 텍스트가 없습니다. 스캔(이미지) PDF 이거나 보호된 파일일 수 있습니다._\n\n` +
      `원본 파일: \`${fileName}\``;
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

// 테스트·디버그용 export
export const __pdfReflow = {
  itemsToLineGeoms,
  reflowLinesToBlocks,
  mergeAcrossPages,
  blocksToMarkdown,
};
