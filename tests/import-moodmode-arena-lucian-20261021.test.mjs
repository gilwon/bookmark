// 무드모드 아레나 칼럼과 루샨 글 이관을 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import {
  LUCIAN_TITLE,
  LUCIAN_URL,
  MOOD_TITLE,
  MOOD_URL,
  isDuplicateRow,
  lucianMarkdownFromArticle,
  moodMarkdownFromHtml,
  stripTracking,
} from "../scripts/import-moodmode-arena-lucian-20261021.mjs";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const WEBP = "data:image/webp;base64,UklGRg==";

const MOOD_HTML = `<!doctype html>
<html><body>
<header>
  <a href="/column">← 칼럼 목록</a>
  <p class="t-small"><span>생산성</span><span>2026년 10월 20일</span><span>· 4분 읽기</span></p>
  <h1>${MOOD_TITLE}</h1>
  <p class="t-body">클로드 100명에게 같은 일을 시키고, 서로 싸우게 해서 끝까지 이긴 답 하나만 받는 스킬이에요.</p>
</header>
<div id="column-markdown">
  <h2>STEP 1. 설치</h2>
  <p><img alt="설치 (완료) 화면" src="/column-media/b34f735a8877/1d1ac1b28c9d.webp"></p>
  <pre><code>https://github.com/Jakeschincariol/arena-skill 이 스킬 설치해줘</code></pre>
  <pre><code>/arena --quick 동네 카페 신메뉴 '흑임자 크림 라떼'의 이름을 하나 지어줘.</code></pre>
  <pre><code>/arena 투자 제안서 첫 페이지 다듬어줘</code></pre>
  <p>우승작은 흑임자구름이에요.</p>
  <p><a href="https://github.com/Jakeschincariol/arena-skill?utm_source=x">arena-skill</a></p>
  <p><a href="https://www.instagram.com/moodmode.ai">@moodmode.ai</a></p>
</div>
<aside>
  <a href="/aeo?from=column&amp;article=claude-arena-100-agent-tournament">AEO 서비스 살펴보기</a>
  <a href="https://open.kakao.com/o/gdmQ4xRi">무드모드 AI 라운지</a>
  <h2>다음에 읽을 글</h2>
</aside>
</body></html>`;

function moodImage(url) {
  assert.equal(
    url,
    "https://moodmode.ai/column-media/b34f735a8877/1d1ac1b28c9d.webp"
  );
  return WEBP;
}

const ARTICLE = {
  title: LUCIAN_TITLE,
  cover_media: {
    media_info: { original_img_url: "https://pbs.twimg.com/media/cover.jpg" },
  },
  media_entities: [
    {
      media_id: "100",
      media_info: { original_img_url: "https://pbs.twimg.com/media/body.png" },
    },
  ],
  content: {
    entityMap: [
      {
        key: "0",
        value: {
          type: "MEDIA",
          data: { mediaItems: [{ mediaId: "100" }] },
        },
      },
      {
        key: "1",
        value: { type: "MARKDOWN", data: { markdown: "```markdown\n/doctor prompt-audit\n```" } },
      },
      { key: "2", value: { type: "DIVIDER", data: {} } },
      {
        key: "3",
        value: {
          type: "LINK",
          data: { url: "https://x.com/lucian__03/status/2103173295118098750?s=46" },
        },
      },
    ],
    blocks: [
      {
        type: "header-one",
        text: "1. 서브에이전트마다 Effort를 다르게 설정하기",
        inlineStyleRanges: [],
        entityRanges: [],
      },
      {
        type: "unstyled",
        text: "1. 파일 위치 찾기와 자료 정리는 low effort로",
        inlineStyleRanges: [{ offset: 0, length: 80, style: "Bold" }],
        entityRanges: [],
      },
      {
        type: "unstyled",
        text: "10. 꼭 지켜야 할 규칙은 Hooks로.",
        inlineStyleRanges: [{ offset: 0, length: 22, style: "Bold" }],
        entityRanges: [],
      },
      {
        type: "unstyled",
        text: "/autocompact 600k",
        inlineStyleRanges: [{ offset: 0, length: 17, style: "Bold" }],
        entityRanges: [],
      },
      {
        type: "unstyled",
        text: "이렇게 하시면 됩니다! 바로 \"세션 ID로 실수 분석시키기\"",
        inlineStyleRanges: [],
        entityRanges: [],
      },
      { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ key: 1, offset: 0, length: 1 }] },
      { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ key: 0, offset: 0, length: 1 }] },
      {
        type: "unstyled",
        text: "1번 미니멀: https://x.com/lucian__03/status/2103173295118098750",
        inlineStyleRanges: [{ offset: 0, length: 59, style: "Bold" }],
        entityRanges: [{ key: 3, offset: 8, length: 51 }],
      },
      {
        type: "ordered-list-item",
        text: "오래 쉬었다가 거대한 세션을 다시 이어갈 때",
        inlineStyleRanges: [],
        entityRanges: [],
      },
      { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ key: 2, offset: 0, length: 1 }] },
      {
        type: "unstyled",
        text: "---",
        inlineStyleRanges: [],
        entityRanges: [],
      },
      {
        type: "unstyled",
        text: "name: light-research",
        inlineStyleRanges: [],
        entityRanges: [],
      },
      {
        type: "unstyled",
        text: "claude --worktree feature-auth",
        inlineStyleRanges: [],
        entityRanges: [],
      },
      {
        type: "unstyled",
        text: "이 글의 명령어는 10월 18일 v2.1.302 기준입니다.",
        inlineStyleRanges: [],
        entityRanges: [],
      },
      {
        type: "unstyled",
        text: "npx claude-mem install",
        inlineStyleRanges: [],
        entityRanges: [],
      },
    ],
  },
};

test("추적 쿼리만 뺀다", () => {
  assert.equal(
    stripTracking("https://x.com/lucian__03/status/2111802461149364647?s=46"),
    LUCIAN_URL
  );
  assert.equal(
    stripTracking("https://example.com/post?s=46"),
    "https://example.com/post?s=46"
  );
  assert.equal(
    stripTracking(`${MOOD_URL}?fbclid=abc&from=column`),
    MOOD_URL
  );
  assert.equal(
    stripTracking("http://localhost/install?utm_source=x"),
    "http://localhost/install"
  );
});

test("제목이나 원문 주소가 같으면 중복이다", () => {
  assert.equal(
    isDuplicateRow({ title: MOOD_TITLE, source_url: "https://example.com" }, MOOD_TITLE, [MOOD_URL]),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: MOOD_URL }, MOOD_TITLE, [MOOD_URL]),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: "https://example.com" }, MOOD_TITLE, [MOOD_URL]),
    false
  );
});

test("무드모드 본문은 이미지와 링크를 남기고 홍보를 뺀다", () => {
  const markdown = moodMarkdownFromHtml(MOOD_HTML, moodImage);
  assert.match(markdown, new RegExp(`\\[설치 \\(완료\\) 화면\\]\\(${WEBP}\\)`));
  assert.match(markdown, /2026년 10월 20일/);
  assert.match(markdown, /STEP 1\. 설치/);
  assert.match(markdown, /흑임자구름/);
  assert.match(markdown, /```[\s\S]*arena-skill 이 스킬 설치해줘[\s\S]*```/);
  assert.match(markdown, new RegExp(`\\(${MOOD_URL}\\)`));
  assert.match(markdown, /https:\/\/github\.com\/Jakeschincariol\/arena-skill\)/);
  assert.doesNotMatch(markdown, /utm_source/);
  assert.doesNotMatch(markdown, /칼럼 목록/);
  assert.doesNotMatch(markdown, /다음에 읽을 글/);
  assert.doesNotMatch(markdown, /AEO 서비스 살펴보기/);
  assert.doesNotMatch(markdown, /무드모드 AI 라운지/);
  assert.doesNotMatch(markdown, /from=column/);
  assert.doesNotMatch(markdown, /column-media\//);
});

test("루샨 글은 번호 문단, 이미지, 코드, 링크를 유지한다", () => {
  const seen = [];
  const markdown = lucianMarkdownFromArticle(ARTICLE, (url) => {
    seen.push(url);
    return PNG;
  });
  assert.deepEqual(seen, [
    "https://pbs.twimg.com/media/cover.jpg",
    "https://pbs.twimg.com/media/body.png",
  ]);
  assert.match(markdown, new RegExp(`!\\[표지\\]\\(${PNG}\\)`));
  assert.match(markdown, new RegExp(`!\\[본문 이미지\\]\\(${PNG}\\)`));
  assert.match(markdown, /^# /);
  assert.match(markdown, /# 1\. 서브에이전트마다 Effort를 다르게 설정하기/);
  assert.match(markdown, /\*\*1\. 파일 위치 찾기와 자료 정리는 low effort로\*\*/);
  assert.match(markdown, /```\n\/doctor prompt-audit\n```/);
  assert.match(markdown, /^---$/m);
  assert.match(
    markdown,
    /\*\*1번 미니멀: \*\*\[https:\/\/x\.com\/lucian__03\/status\/2103173295118098750\]\(https:\/\/x\.com\/lucian__03\/status\/2103173295118098750\)/
  );
  assert.doesNotMatch(markdown, /[?&]s=/);
  assert.doesNotMatch(markdown, /pbs\.twimg\.com/);
  assert.match(markdown, new RegExp(`${"\u200b"}---`));
  assert.match(markdown, /name: light-research/);
  assert.match(markdown, /claude --worktree feature-auth/);
  assert.match(markdown, /v2\.1\.302/);
  assert.match(markdown, /npx claude-mem install/);
  assert.match(markdown, new RegExp(`\\(${LUCIAN_URL}\\)`));
});
