// 리틀리 프로필과 영선 오픈소스 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { markdownToTiptapDoc } from "../src/lib/markdown-to-tiptap.ts";
import { documentStats } from "../scripts/import-claude-eli5-page.mjs";
import {
  LITTLY_LINKS,
  LITTLY_SUBTITLE,
  LITTLY_TITLE,
  LITTLY_URL,
  YEONGSEON_LINKS,
  YEONGSEON_TITLE,
  YEONGSEON_URL,
  decideSkip,
  isDuplicateRow,
  littlyMarkdown,
  parseYeongseonHtml,
  profileFromHtml,
  sourceMarkers,
  stripTracking,
} from "../scripts/import-littly-yeongseon-20261014.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-littly-yeongseon-20261014.mjs"
);
const source = readFileSync(SCRIPT_PATH, "utf8");
const DATA_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const DATA_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAk";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  assert.equal(
    source.split("\n")[0],
    "// 리틀리 프로필과 영선 오픈소스 글을 Pages에만 저장한다"
  );
  assert.equal(source.includes(["fb", "clid"].join("")), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(/\.update\(/.test(source), false);
  assert.equal(source.includes('from("prompts")'), false);
});

test("추적 쿼리를 빼고 localhost는 http로 남긴다", () => {
  const raw = `${LITTLY_URL}?utm_source=ig&utm_medium=social&utm_content=link_in_bio&${["fb", "clid"].join("")}=abc`;
  assert.equal(stripTracking(raw), LITTLY_URL);
  assert.equal(
    stripTracking(
      "https://every-ai-guides.vercel.app/posts/claude-design-skills-5?from=littly"
    ),
    LITTLY_LINKS[1]
  );
  assert.equal(
    stripTracking(`${YEONGSEON_URL}?${["fb", "clid"].join("")}=abc`),
    YEONGSEON_URL
  );
  assert.equal(stripTracking("http://localhost/install"), "http://localhost/install");
});

test("같은 원문이나 같은 제목이면 건너뛴다", () => {
  const markers = sourceMarkers(LITTLY_URL);
  const tracked = {
    id: "tracked",
    title: "다른 제목",
    source_url: `${LITTLY_URL}?utm_source=ig`,
  };
  assert.equal(isDuplicateRow(tracked, LITTLY_TITLE, markers), true);
  assert.equal(
    isDuplicateRow(
      { id: "other", title: LITTLY_TITLE, source_url: "https://example.com/a" },
      LITTLY_TITLE,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { id: "near", title: "every._ai 클로드 실전 자료 모음", source_url: "https://example.com/b" },
      LITTLY_TITLE,
      markers
    ),
    false
  );
  const both = decideSkip([tracked], [tracked], LITTLY_TITLE, markers);
  assert.equal(both.skip, true);
  const titleOnly = decideSkip(
    [{ id: "title", title: YEONGSEON_TITLE, source_url: "https://example.com/other" }],
    [],
    YEONGSEON_TITLE,
    sourceMarkers(YEONGSEON_URL)
  );
  assert.equal(titleOnly.skip, true);
  assert.equal(titleOnly.preferredId, null);
  const oneSide = decideSkip([tracked], [], LITTLY_TITLE, markers);
  assert.equal(oneSide.skip, false);
  assert.equal(oneSide.preferredId, "tracked");
});

test("리틀리 카드 이미지와 링크를 남긴다", () => {
  const profile = {
    title: LITTLY_TITLE,
    subtitle: LITTLY_SUBTITLE,
    profileImageUrl: "https://cdn.litt.ly/images/profile",
    cards: [
      {
        title: "인스타툰 노하우",
        url: LITTLY_LINKS[0],
        imageUrl: "https://cdn.litt.ly/images/card",
      },
      {
        title: "클로드 디자인 스킬 5개",
        url: `${LITTLY_LINKS[1]}?from=littly`,
        imageUrl: "https://cdn.litt.ly/images/design",
      },
    ],
  };
  const images = new Map([
    ["https://cdn.litt.ly/images/profile", DATA_JPEG],
    ["https://cdn.litt.ly/images/card", DATA_PNG],
    ["https://cdn.litt.ly/images/design", DATA_JPEG],
  ]);
  const dirty = {
    ...profile,
    cards: profile.cards.map((card) => ({ ...card, url: stripTracking(card.url) })),
  };
  const { markdown } = littlyMarkdown(dirty, images);
  const stats = documentStats(JSON.stringify(markdownToTiptapDoc(markdown)));
  assert.equal(markdown.startsWith(`# ${LITTLY_TITLE}`), true);
  assert.equal(stats.images, 3);
  assert.equal(stats.attachments, 0);
  assert.equal(markdown.includes(LITTLY_LINKS[0]), true);
  assert.equal(markdown.includes(LITTLY_LINKS[1]), true);
  assert.equal(markdown.includes("from=littly"), false);
  assert.equal(markdown.includes(DATA_PNG), true);
});

test("리틀리 HTML의 base64 프로필만 카드로 읽는다", () => {
  const payload = {
    profile: {
      title: LITTLY_TITLE,
      subtitle: LITTLY_SUBTITLE,
      image: { url: "/images/profile" },
    },
    blocks: [
      {
        use: true,
        type: "link",
        title: "인스타툰",
        url: `${LITTLY_LINKS[0]}?utm_source=littly&utm_medium=bio`,
        image: { url: "/images/card" },
      },
      {
        use: false,
        type: "link",
        title: "숨김",
        url: "https://example.com/hidden",
        image: { url: "/images/hidden" },
      },
      {
        use: true,
        type: "productLink",
        links: [
          {
            use: true,
            title: "디자인 스킬",
            url: `${LITTLY_LINKS[1]}?from=littly`,
            image: { url: "/images/design" },
          },
        ],
      },
    ],
  };
  const html = `<script>${Buffer.from(JSON.stringify(payload)).toString("base64")}</script>`;
  const profile = profileFromHtml(html);
  assert.equal(profile.title, LITTLY_TITLE);
  assert.equal(profile.profileImageUrl, "https://cdn.litt.ly/images/profile");
  assert.equal(profile.cards.length, 2);
  assert.equal(profile.cards[0].url, LITTLY_LINKS[0]);
  assert.equal(profile.cards[1].url, LITTLY_LINKS[1]);
  assert.equal(profile.cards.some((card) => card.url.includes("example.com")), false);
});

test("영선 본문 링크와 코드는 남기고 홍보는 뺀다", () => {
  const html = `<!doctype html>
  <html><head><title>${YEONGSEON_TITLE} · 신영선 자료</title></head>
  <body>
    <header><a href="../index.html">신영선</a></header>
    <article class="wrap">
      <ul class="chips"><li>신영선</li></ul>
      <h1>${YEONGSEON_TITLE}</h1>
      <p class="sum">별 50만 개 받은 도구로 모델부터 서비스까지 만드세요</p>
      <p class="meta">2026. 9. 28.</p>
      <aside class="note">10배 더 빠르게 흡수하는 방법</aside>
      <p>1. 릴스 영상을 저장 또는 공유하기로 기록 해놓습니다.</p>
      <ol><li>바로 사용을 해봅니다.</li></ol>
      <pre><code>ollama run qwen3</code></pre>
      <p>🔗 GitHub : <a href="https://github.com/ollama/ollama">https://github.com/ollama/ollama</a></p>
      <pre><code>pip install 'markitdown[all]'</code></pre>
      <p><a href="https://www.python.org/downloads/">python.org</a></p>
      <pre><code>markitdown 보고서.pdf -o 보고서.md</code></pre>
      <p><a href="https://github.com/microsoft/markitdown">https://github.com/microsoft/markitdown</a></p>
      <p><a href="https://ollama.com/">ollama.com</a></p>
      <p><a href="https://cloud.dify.ai/">cloud.dify.ai</a></p>
      <p><a href="https://www.docker.com/products/docker-desktop/">Docker Desktop</a></p>
      <pre><code>git clone https://github.com/langgenius/dify.git</code></pre>
      <p><a href="https://github.com/langgenius/dify">https://github.com/langgenius/dify</a></p>
      <p>브라우저에서 <code>http://localhost/install</code> 로 들어갑니다.</p>
      <table><tr><th>도구</th></tr><tr><td><a href="https://ollama.com/docs">문서</a></td></tr></table>
      <aside class="note">이 글을 보는 분들께. 아래 단톡방으로 참여해주세요.</aside>
      <aside class="promo"><a href="https://open.kakao.com/o/gooW0TBi">단톡</a></aside>
      <nav class="rel"><h2>이어서 볼 것</h2></nav>
      <div class="cta"><p>이런 자료를 이메일로 받아보시겠습니까?</p></div>
    </article>
  </body></html>`;
  const { title, markdown } = parseYeongseonHtml(html);
  const stats = documentStats(JSON.stringify(markdownToTiptapDoc(markdown)));
  assert.equal(title, YEONGSEON_TITLE);
  assert.equal(markdown.split("\n")[0].includes("—"), false);
  assert.equal(markdown.includes("\u200B2026. 9. 28."), true);
  assert.equal(markdown.includes("\u200B1. 릴스 영상을 저장"), true);
  assert.equal(markdown.includes("ollama run qwen3"), true);
  assert.equal(markdown.includes("http://localhost/install"), true);
  assert.equal(markdown.includes("https://ollama.com/docs"), true);
  for (const url of YEONGSEON_LINKS) assert.equal(markdown.includes(url), true);
  assert.equal(markdown.includes("open.kakao.com"), false);
  assert.equal(markdown.includes("이어서 볼 것"), false);
  assert.equal(markdown.includes("이메일로 받아"), false);
  assert.equal(stats.images, 0);
  assert.equal(stats.attachments, 0);
  assert.equal(stats.codes, 4);
  assert.equal(stats.tables, 1);
  assert.equal(stats.hrefs.includes("https://ollama.com/docs"), true);
});
