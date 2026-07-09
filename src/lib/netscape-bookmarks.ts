// 브라우저/Chrome 등 Netscape 북마크 HTML export 파서

export type ParsedBookmark = {
  url: string;
  title: string;
  /** 폴더 경로 (예: "개발/React") */
  category: string | null;
  addDate: string | null;
};

/**
 * NETSCAPE-Bookmark-file-1 HTML 문자열에서 링크를 추출한다.
 * 브라우저 DOMParser 사용 (클라이언트 전용).
 */
export function parseNetscapeBookmarksHtml(html: string): ParsedBookmark[] {
  if (typeof DOMParser === "undefined") {
    throw new Error("DOMParser 를 사용할 수 없습니다.");
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const results: ParsedBookmark[] = [];

  /** DL 요소를 폴더 경로와 함께 순회한다. */
  function walkDl(dl: Element, folderPath: string[]) {
    // DT 직접/간접 자식 처리 (중간 <p> 등 허용)
    const children = Array.from(dl.children);
    for (let i = 0; i < children.length; i++) {
      const el = children[i]!;
      if (el.tagName !== "DT") {
        // 일부 export 는 DT 없이 A 가 올 수 있음
        if (el.tagName === "A") {
          pushAnchor(el as HTMLAnchorElement, folderPath);
        } else if (el.tagName === "DL") {
          walkDl(el, folderPath);
        }
        continue;
      }

      const h3 = el.querySelector(":scope > h3, :scope > H3");
      const a = el.querySelector(":scope > a, :scope > A");

      if (h3) {
        const name = (h3.textContent || "").trim() || "폴더";
        const nextPath = [...folderPath, name];
        // 폴더 본문 DL: DT 다음 형제 또는 DT 내부
        let folderDl: Element | null =
          el.querySelector(":scope > dl, :scope > DL") ||
          (el.nextElementSibling?.tagName === "DL"
            ? el.nextElementSibling
            : null);
        // <p> 래퍼 건너뛰기
        if (
          !folderDl &&
          el.nextElementSibling?.tagName === "P" &&
          el.nextElementSibling.nextElementSibling?.tagName === "DL"
        ) {
          folderDl = el.nextElementSibling.nextElementSibling;
        }
        if (folderDl) walkDl(folderDl, nextPath);
      } else if (a) {
        pushAnchor(a as HTMLAnchorElement, folderPath);
      }
    }
  }

  function pushAnchor(a: HTMLAnchorElement, folderPath: string[]) {
    const href = (a.getAttribute("HREF") || a.getAttribute("href") || "").trim();
    if (!href) return;
    // javascript:, data: 등 제외
    if (/^(javascript:|data:|place:)/i.test(href)) return;

    let url = href;
    if (!/^https?:\/\//i.test(url) && !url.startsWith("file:")) {
      // 상대/기타 스킴은 일단 스킵 (http(s) 위주)
      if (!/^https?:\/\//i.test(url)) {
        // chrome 일부 about: 제외
        if (!url.startsWith("http")) return;
      }
    }

    const title =
      (a.textContent || "").trim() ||
      (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      })();

    const addRaw =
      a.getAttribute("ADD_DATE") || a.getAttribute("add_date") || null;
    let addDate: string | null = null;
    if (addRaw && /^\d+$/.test(addRaw)) {
      const ms = Number(addRaw) * (addRaw.length <= 10 ? 1000 : 1);
      if (!Number.isNaN(ms)) addDate = new Date(ms).toISOString();
    }

    // 최상위 "북마크 모음" / "Bookmarks Bar" 등은 카테고리로 유지
    const category =
      folderPath.length > 0 ? folderPath.join("/") : null;

    results.push({ url, title, category, addDate });
  }

  // 루트 DL 들
  const rootDls = doc.querySelectorAll("dl, DL");
  if (rootDls.length === 0) {
    // DL 없이 A 만 있는 경우
    doc.querySelectorAll("a[href], A[HREF]").forEach((node) => {
      pushAnchor(node as HTMLAnchorElement, []);
    });
  } else {
    // 최상위 DL 만 (중첩은 walk 이 처리). 첫 DL 이 전체 루트인 경우가 많음
    const top = rootDls[0]!;
    walkDl(top, []);
  }

  // URL 기준 중복 제거 (뒤에 나온 것 우선 → 먼저 나온 폴더 유지하려면 앞 우선)
  const seen = new Set<string>();
  const unique: ParsedBookmark[] = [];
  for (const item of results) {
    const key = item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

/** 북마크 HTML 파일로 보이는지 대략 판별 */
export function looksLikeBookmarkHtml(html: string, filename?: string): boolean {
  if (filename && /\.html?$/i.test(filename)) {
    // 파일명이 bookmarks 를 포함하면 강하게 긍정
    if (/bookmark/i.test(filename)) return true;
  }
  const head = html.slice(0, 2000);
  return (
    /NETSCAPE-Bookmark-file/i.test(head) ||
    (/<DL/i.test(head) && /<A\s[^>]*HREF=/i.test(html)) ||
    (/DOCTYPE HTML/i.test(head) && /ADD_DATE/i.test(html))
  );
}
