// every._ai 글 목록 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { documentStats } from "../scripts/import-claude-eli5-page.mjs";
import { markdownToTiptapDoc } from "../src/lib/markdown-to-tiptap.ts";
import {
  attachmentKind,
  canonicalPostUrl,
  decideSkip,
  imageDataUrl,
  isDuplicateRow,
  parseEveryAiHtml,
  postsFromIndex,
  sourceMarkers,
  stripTracking,
} from "../scripts/import-every-ai-index-20261013.mjs";

const TRACKING = ["fb", "clid"].join("");
const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-every-ai-index-20261013.mjs"
);
const SOURCE_URL = "https://every-ai-guides.vercel.app/posts/sample-post";
const PAGE_TITLE = "샘플 가이드 제목";
const PNG_URL = "data:image/png;base64,iVBORw0KGgo=";
const PDF_URL = "data:application/pdf;base64,JVBERg==";

const INDEX_HTML = `<!doctype html>
<html><body>
  <nav><a href="/skills/">스킬</a></nav>
  <a href="/shorts-factory/">쇼츠 제작 무료 가이드 읽기</a>
  <a class="skill-strip-link" href="/skills/ai-shorts-factory-lite.html">무료로 받기</a>
  <form><input type="email" /></form>
  <a class="card" href="/posts/sample-post.html?from=dm&amp;${TRACKING}=x">
    <h3><em>샘플</em> 가이드 제목</h3>
  </a>
  <a class="card" href="/posts/other-post.html">
    <h3>다른 글</h3>
  </a>
</body></html>`;

const ARTICLE_HTML = `<!doctype html>
<html lang="ko">
  <body>
    <nav><a href="https://youtube.com/@every._ai">유튜브</a></nav>
    <article class="post">
      <h1>${PAGE_TITLE} — every._ai</h1>
      <div class="sub"><span>읽는 데 6분</span><span>2026-09-17 공개</span></div>
      <a class="bootcamp-post-banner" href="/class/bootcamp-oct.html?from=dm">부트캠프</a>
      <div class="challenge-post-banner"><span>AI 수익화 챌린지</span></div>
      <a class="kakao-post-cta" href="/kakao?from=guide">카카오</a>
      <img src="/img/class/claude-icon.png" alt="Claude">
      <a href="https://instagram.com/every._ai?utm_source=nav">인스타</a>
      <h2><span class="n">STEP 1 · 3분</span>Superpowers</h2>
      <p>2026. 9. 18. 기록</p>
      <ol><li>항목</li></ol>
      <pre>curl http://localhost:3000/health
http://example.com/x?from=dm</pre>
      <p><a href="http://example.com/docs?utm_source=news&amp;from=dm">예시</a></p>
      <p><a href="/posts/designlang.html">디자인 글</a></p>
      <p><a href="/downloads/claude-10/practice.zip">연습</a></p>
      <p><strong><a href="${PDF_URL}">클로드 코드 시작하기 — PDF 20면</a></strong></p>
      <p><a href="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/data/ui-reasoning.csv">csv</a></p>
      <img src="${PNG_URL}" alt="입력 예시">
      <table>
        <tr><th>이름</th><th>주소</th></tr>
        <tr><td>예시</td><td><a href="https://example.com/item?utm_source=x">열기</a></td></tr>
      </table>
    </article>
    <footer><a href="https://youtube.com/@every._ai?from=guide">유튜브</a></footer>
  </body>
</html>`;

function parsedPage() {
  return parseEveryAiHtml(ARTICLE_HTML, SOURCE_URL);
}

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// every._ai 글 목록에서 아직 없는 글만 Pages에 저장한다"
  );
  assert.equal(source.includes("article.post"), true);
  assert.equal(source.includes("a.bootcamp-post-banner"), true);
  assert.equal(source.includes(".challenge-post-banner"), true);
  assert.equal(source.includes("a.challenge-post-banner"), true);
  assert.equal(source.includes("a.kakao-post-cta"), true);
  assert.equal(source.includes("section.challenge-banner"), true);
  assert.equal(source.includes("h2 span.n"), true);
  assert.equal(source.includes("div.sub span + span"), true);
  assert.equal(source.includes('const LOCAL_USER = "dev"'), true);
  assert.equal(
    source.includes('const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97"'),
    true
  );
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(/UPDATE\s+custom_pages/i.test(source), false);
  assert.equal(source.includes(TRACKING), false);
  const checkAt = source.indexOf("if (checkOnly)");
  const persistAt = source.indexOf("await persist(");
  assert.equal(checkAt > 0 && persistAt > checkAt, true);
});

test("글 카드만 원문 주소로 읽고 html 접미는 뺀다", () => {
  const posts = postsFromIndex(INDEX_HTML);
  assert.deepEqual(
    posts.map((post) => post.slug),
    ["sample-post", "other-post"]
  );
  assert.equal(posts[0].title, "샘플 가이드 제목");
  assert.equal(
    posts[0].sourceUrl,
    "https://every-ai-guides.vercel.app/posts/sample-post"
  );
  assert.equal(
    canonicalPostUrl("/posts/sample-post.html?from=dm"),
    "https://every-ai-guides.vercel.app/posts/sample-post"
  );
  assert.deepEqual(sourceMarkers(posts[0].sourceUrl), [
    "https://every-ai-guides.vercel.app/posts/sample-post",
    "https://every-ai-guides.vercel.app/posts/sample-post.html",
  ]);
});

test("isDuplicateRow는 제목 또는 원문 주소가 정확히 같을 때만 true다", () => {
  const markers = sourceMarkers(SOURCE_URL);
  assert.equal(isDuplicateRow(null, PAGE_TITLE, markers), false);
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, source_url: "https://example.com" }, PAGE_TITLE, markers),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: `${SOURCE_URL}.html` },
      PAGE_TITLE,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: `${PAGE_TITLE} 외`, source_url: "https://example.com", content: SOURCE_URL },
      PAGE_TITLE,
      markers
    ),
    false
  );
});

test("같은 원문이 양쪽에 있으면 건너뛰고 제목만 같은 다른 글도 넣지 않는다", () => {
  const markers = sourceMarkers(SOURCE_URL);
  const local = [
    { id: "local-1", title: PAGE_TITLE, source_url: SOURCE_URL },
  ];
  const prod = [
    { id: "local-1", title: PAGE_TITLE, source_url: `${SOURCE_URL}.html` },
  ];
  assert.equal(decideSkip(local, prod, PAGE_TITLE, markers).skip, true);
  const other = decideSkip(
    [{ id: "other", title: PAGE_TITLE, source_url: "https://example.com/other" }],
    [],
    PAGE_TITLE,
    markers
  );
  assert.equal(other.skip, true);
  assert.equal(other.preferredId, null);
  const missingProd = decideSkip(local, [], "카드 제목", markers);
  assert.equal(missingProd.skip, false);
  assert.equal(missingProd.preferredId, "local-1");
});

test("본문 이미지 PNG 바이트는 data URL이 되고 ZIP은 링크다", () => {
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(
    imageDataUrl(bytes, "application/octet-stream").startsWith("data:image/png;base64,"),
    true
  );
  assert.equal(
    attachmentKind("https://every-ai-guides.vercel.app/downloads/claude-10/practice.zip"),
    "zip"
  );
  assert.equal(
    attachmentKind("https://every-ai-guides.vercel.app/downloads/claude-code-start.pdf"),
    "pdf"
  );
  assert.equal(
    attachmentKind("https://every-ai-guides.vercel.app/posts/designlang.html"),
    "link"
  );
  assert.equal(
    attachmentKind(
      "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/data/ui-reasoning.csv"
    ),
    "link"
  );
});

test("추적 쿼리를 빼고 펜스 안 localhost는 http로 남긴다", () => {
  const { markdown } = parsedPage();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(markdown.split("\n")[0].includes("—"), false);
  assert.equal(markdown.includes("every._ai"), true);
  assert.equal(markdown.includes("클로드 코드 시작하기 — PDF 20면"), true);
  assert.equal(markdown.includes("AI 수익화 챌린지"), false);
  assert.equal(markdown.includes("youtube.com"), false);
  assert.equal(markdown.includes("instagram.com/every"), false);
  assert.equal(markdown.includes("claude-icon.png"), false);
  assert.equal(markdown.includes("utm_source"), false);
  assert.equal(markdown.includes("from=dm"), false);
  assert.equal(markdown.includes(TRACKING), false);
  assert.equal(markdown.includes("STEP 1 · 3분 Superpowers"), true);
  assert.equal(markdown.includes("읽는 데 6분 2026-09-17 공개"), true);
  assert.equal(markdown.includes("\u200B2026. 9. 18. 기록"), true);
  assert.equal(markdown.includes("\u200B1."), false);
  assert.match(markdown, /(^|\n)1\.\s+항목/);
  assert.equal(markdown.includes("http://localhost:3000/health"), true);
  assert.equal(markdown.includes("http://example.com/x"), true);
  assert.equal(markdown.includes("https://example.com/docs"), true);
  assert.equal(
    markdown.includes("https://every-ai-guides.vercel.app/posts/designlang.html"),
    true
  );
  assert.equal(
    markdown.includes("https://every-ai-guides.vercel.app/downloads/claude-10/practice.zip"),
    true
  );
  assert.equal(markdown.includes("data:application/zip"), false);
  assert.equal(markdown.includes(PDF_URL), true);
  assert.equal(markdown.includes("data:image/png;base64,"), true);
  assert.equal(
    markdown.includes(
      "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/data/ui-reasoning.csv"
    ),
    true
  );
  assert.equal(markdown.includes("https://example.com/item"), true);
  const cleaned = stripTracking("http://example.com/docs?utm_source=news&from=guide");
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("from=guide"), false);
});

test("TipTap에 이미지와 PDF 첨부와 표 링크가 남는다", () => {
  const { markdown } = parsedPage();
  const stats = documentStats(JSON.stringify(markdownToTiptapDoc(markdown)));
  assert.equal(stats.images, 1);
  assert.equal(stats.attachments, 1);
  assert.equal(stats.tables, 1);
  assert.equal(
    stats.hrefs.includes("https://every-ai-guides.vercel.app/downloads/claude-10/practice.zip"),
    true
  );
  assert.equal(stats.hrefs.includes("https://example.com/item"), true);
  assert.equal(
    stats.hrefs.some((href) => href.startsWith("data:application/pdf;base64,")),
    true
  );
});
