// every._ai 클로드 코드 유출 지시서 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  MEMORY_DOCS_URL,
  PAGE_TITLE,
  PROMPT_TXT_URL,
  PROMPT_V2_URL,
  SOURCE_URL,
  isDuplicateRow,
  parseEveryAiHtml,
  stripTracking,
} from "../scripts/import-every-ai-leaked-prompts-12.mjs";

const OTHER_TITLE =
  "클로드를 10년차 베테랑 마케터로 만드는 marketingskills 스킬 5개";
const OTHER_URL = "https://every-ai-guides.vercel.app/posts/skill-pack-marketing";
const TRACKING = ["fb", "clid"].join("");
const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-every-ai-leaked-prompts-12.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>${PAGE_TITLE} — every._ai</title>
  </head>
  <body>
    <nav>
      <a href="https://youtube.com/@every._ai">유튜브</a>
      <a href="https://instagram.com/every._ai?utm_source=nav">인스타그램</a>
    </nav>
    <article class="post">
      <div class="head">
        <h1>${PAGE_TITLE} — every._ai</h1>
        <div class="sub"><span>읽는 데 8분</span><span>2026-10-11 공개</span></div>
      </div>
      <a class="bootcamp-post-banner" href="/class/bootcamp-oct.html?from=dm">부트캠프</a>
      <div class="challenge-post-banner">
        <span>AI 수익화 챌린지</span>
        <a href="/money-map?from=guide">자료집</a>
      </div>
      <a class="challenge-post-banner" href="/money-map?from=dm">챌린지 배너</a>
      <a class="kakao-post-cta" href="/kakao?from=guide">하단 카카오 배너</a>
      <img src="/img/class/claude-icon.png" alt="Claude">
      <a href="https://youtube.com/@every._ai?from=dm">유튜브 메뉴</a>
      <a href="https://instagram.com/every._ai">인스타 메뉴</a>
      <h2>Quick Start</h2>
      <h2>12줄 한눈에 보기</h2>
      <h2><span class="n">STEP 1 · 답하는 방식</span>답은 4줄</h2>
      <div class="prompt">
        <button type="button">복사</button>
        <pre>ping http://localhost:3000/health</pre>
      </div>
      <pre>답은 4줄이다.</pre>
      <table>
        <tr><th>줄</th><th>규칙</th></tr>
        <tr><td>1</td><td>짧게</td></tr>
      </table>
      <ul>
        <li><a href="${PROMPT_TXT_URL}?utm_source=share&amp;from=guide">Prompt.txt</a></li>
        <li><a href="${PROMPT_V2_URL}?${TRACKING}=x&amp;from=dm">2.0.txt</a></li>
        <li><a href="${MEMORY_DOCS_URL}?utm_medium=mail">memory</a></li>
      </ul>
      <script>var marker = "from=dm";</script>
    </article>
    <footer>
      <a href="https://instagram.com/every._ai">every</a>
    </footer>
  </body>
</html>`;

function countNodes(node, type) {
  let count = node?.type === type ? 1 : 0;
  for (const child of node?.content ?? []) count += countNodes(child, type);
  return count;
}

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// every._ai 클로드 코드 유출 지시서 12줄을 Pages에만 저장한다"
  );
  assert.equal(source.includes("article.post"), true);
  assert.equal(source.includes("a.bootcamp-post-banner"), true);
  assert.equal(source.includes(".challenge-post-banner"), true);
  assert.equal(source.includes("a.challenge-post-banner"), true);
  assert.equal(source.includes("a.kakao-post-cta"), true);
  assert.equal(source.includes("h2 span.n"), true);
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
  assert.equal(source.includes(OTHER_TITLE), false);
  assert.equal(source.includes(OTHER_URL), false);
  const checkAt = source.indexOf("if (checkOnly)");
  const persistAt = source.indexOf("await persist(");
  assert.equal(checkAt > 0 && persistAt > checkAt, true);
});

test("PAGE_TITLE과 SOURCE_URL과 개수 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://every-ai-guides.vercel.app/posts/claude-code-leaked-prompts-12"
  );
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes(TRACKING), false);
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(PAGE_TITLE, "클로드가 숨겨온 지시서, 통째로 유출됐다");
  assert.equal(PAGE_TITLE.includes("every._ai"), false);
  assert.equal(PAGE_TITLE.includes("—"), false);
  assert.equal(EXPECTED_IMAGES, 0);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 1);
  assert.equal(EXPECTED_CODES, 13);
  assert.equal(
    PROMPT_TXT_URL,
    "https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools/blob/main/Anthropic/Claude%20Code/Prompt.txt"
  );
  assert.equal(
    PROMPT_V2_URL,
    "https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools/blob/main/Anthropic/Claude%20Code%202.0.txt"
  );
  assert.equal(MEMORY_DOCS_URL, "https://code.claude.com/docs/en/memory");
});

test("다른 글 제목과 URL이면 중복이 아니다", () => {
  assert.notEqual(PAGE_TITLE, OTHER_TITLE);
  assert.notEqual(SOURCE_URL, OTHER_URL);
  assert.equal(
    isDuplicateRow(
      { title: OTHER_TITLE, source_url: OTHER_URL, content: OTHER_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});

test("isDuplicateRow는 제목 또는 source_url이 정확히 같을 때만 true다", () => {
  assert.equal(isDuplicateRow(null, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, content: "x" }, PAGE_TITLE, [SOURCE_URL]),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL, content: "없음" },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: "https://example.com", content: SOURCE_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: `${SOURCE_URL}/extra`, content: "없음" },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});

test("stripTracking은 utm, fbclid, from=dm, from=guide를 빼고 data URL은 둔다", () => {
  const dataUrl = "data:image/png;base64,abc";
  const dirty = `${SOURCE_URL}?utm_source=share&${TRACKING}=x&from=dm&from=guide`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes(TRACKING), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("from=dm"), false);
  assert.equal(cleaned.includes("from=guide"), false);
  assert.equal(cleaned, SOURCE_URL);
  assert.equal(stripTracking(`${SOURCE_URL}?from=guide`), SOURCE_URL);
  assert.equal(stripTracking(dataUrl), dataUrl);
  assert.equal(
    stripTracking("http://localhost:3000/health"),
    "http://localhost:3000/health"
  );
});

test("parseEveryAiHtml은 배너를 빼고 지시서 링크와 코드만 남긴다", () => {
  const dirty = `${SOURCE_URL}/?utm_source=share&${TRACKING}=x&from=dm&from=guide`;
  const parsed = parseEveryAiHtml(FIXTURE, dirty);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [every._ai](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("— every._ai"), false);
  assert.equal(parsed.markdown.includes("Quick Start"), true);
  assert.equal(parsed.markdown.includes("12줄 한눈에 보기"), true);
  assert.equal(parsed.markdown.includes("2026-10-11"), true);
  assert.equal(parsed.markdown.includes("STEP 1 · 답하는 방식 답은 4줄"), true);
  assert.equal(parsed.markdown.includes("방식답은"), false);
  assert.match(parsed.markdown, /```\nping http:\/\/localhost:3000\/health/);
  assert.equal(parsed.markdown.includes("https://localhost"), false);
  assert.equal(parsed.markdown.includes("| 줄 | 규칙 |"), true);
  assert.equal(parsed.markdown.includes("| 1 | 짧게 |"), true);
  const links = [
    ...parsed.markdown.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(links)].sort(),
    [MEMORY_DOCS_URL, PROMPT_TXT_URL, PROMPT_V2_URL, SOURCE_URL].sort()
  );
  assert.equal(parsed.markdown.includes(TRACKING), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes("from=dm"), false);
  assert.equal(parsed.markdown.includes("from=guide"), false);
  assert.equal(parsed.markdown.includes("AI 수익화 챌린지"), false);
  assert.equal(parsed.markdown.includes("youtube.com"), false);
  assert.equal(parsed.markdown.includes("instagram.com/every"), false);
  assert.equal(parsed.markdown.includes("claude-icon"), false);
  assert.equal(parsed.markdown.includes("하단 카카오 배너"), false);
  assert.equal(parsed.markdown.includes("복사"), false);
  assert.equal(parsed.markdown.includes("money-map"), false);

  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  tsx.register({ tsconfig: resolve(repoRoot, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(repoRoot, "src/lib/markdown-to-tiptap.ts")
  );
  const doc = markdownToTiptapDoc(parsed.markdown);
  assert.equal(countNodes(doc, "codeBlock"), 2);
  assert.equal(countNodes(doc, "table"), 1);
  assert.equal(countNodes(doc, "image"), 0);
});
