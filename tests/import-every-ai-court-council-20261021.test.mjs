// every._ai court 스킬과 카운슬 프롬프트 이관 헬퍼를 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import {
  COURT_TITLE,
  COURT_URL,
  COUNCIL_TITLE,
  COUNCIL_URL,
  articleMarkdownFromHtml,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-every-ai-court-council-20261021.mjs";

const TRACKING = ["fb", "clid"].join("");

test("추적 쿼리만 뺀다", () => {
  const social = stripTracking(
    `https://x.com/lucian__03/status/1?s=46&${TRACKING}=abc`
  );
  assert.equal(social, "https://x.com/lucian__03/status/1");
  const kept = stripTracking("https://example.com/a?s=1&from=guide-top");
  assert.equal(kept, "https://example.com/a?s=1");
  const local = stripTracking(
    `http://localhost:3000/x?from=dm&${TRACKING}=1`
  );
  assert.equal(local, "http://localhost:3000/x");
  const upgraded = stripTracking("http://github.com/karpathy/llm-council?from=guide");
  assert.equal(upgraded, "https://github.com/karpathy/llm-council");
});

test("제목이나 원문 주소가 같으면 중복이다", () => {
  assert.equal(
    isDuplicateRow({ title: COURT_TITLE, source_url: "https://example.com" }, COURT_TITLE, [
      COURT_URL,
    ]),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: COUNCIL_URL }, COUNCIL_TITLE, [
      COUNCIL_URL,
    ]),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: "https://example.com" }, COURT_TITLE, [
      COURT_URL,
    ]),
    false
  );
});

test("court 본문은 코드와 링크를 남기고 홍보를 뺀다", () => {
  const html = `<!doctype html><html><body>
    <article class="post"><div class="wrap">
      <h1>${COURT_TITLE}</h1>
      <div class="sub"><span>읽는 데 5분</span><span>2026-10-20 공개</span></div>
      <div class="challenge-post-banner">
        <span>every._ai 수익화 노하우</span>
        <a class="cpb-main" href="/littly?from=guide-top&post=claude-court-skill">모음</a>
        <a href="/kakao?from=guide-top">카톡방</a>
      </div>
      <img src="/img/claude-icon.png" alt="Claude">
      <h2><span class="n">STEP 1 · 1분</span>court 스킬을 설치한다</h2>
      <p><a href="https://github.com/alexyc9381/court-skill">court 스킬</a>은 <a href="https://instagram.com/nocodealex">@nocodealex</a>이 만들었다.</p>
      <div class="prompt"><button type="button">복사</button><pre>npx skills add alexyc9381/court-skill</pre></div>
      <pre>/court --quick 방금 답을 재판해 줘</pre>
      <p>성공하면 VERDICT.md가 생긴다. 배심원 12명이 투표한다.</p>
      <a class="kakao-post-cta" href="/kakao?from=guide"><strong>카톡방</strong></a>
    </div></article>
    <footer><a href="https://instagram.com/every._ai">@every._ai</a></footer>
  </body></html>`;
  const markdown = articleMarkdownFromHtml(html, COURT_URL, COURT_TITLE);
  assert.match(markdown, new RegExp(`^# ${COURT_TITLE}\\n`));
  assert.match(markdown, /> 원문\. \[every\._ai\]\(https:\/\/every-ai-guides\.vercel\.app\/posts\/claude-court-skill\)/);
  assert.match(markdown, /읽는 데 5분 2026-10-20 공개/);
  assert.match(markdown, /## STEP 1 · 1분 court 스킬을 설치한다/);
  assert.equal((markdown.match(/^```$/gm) || []).length, 4);
  assert.match(markdown, /\[court 스킬\]\(https:\/\/github\.com\/alexyc9381\/court-skill\)/);
  assert.match(markdown, /\[@nocodealex\]\(https:\/\/instagram\.com\/nocodealex\)/);
  for (const snippet of ["수익화 노하우", "카톡방", "kakao", "from=guide", "instagram.com/every", "claude-icon", "복사"]) {
    assert.equal(markdown.includes(snippet), false, snippet);
  }
});

test("카운슬 프롬프트의 헤딩 문법은 코드 안에 남는다", () => {
  const html = `<!doctype html><html><body>
    <article class="post"><div class="wrap">
      <h1>${COUNCIL_TITLE} — every._ai</h1>
      <div class="sub"><span>읽는 데 5분</span><span>2026-10-20 공개</span></div>
      <div class="challenge-post-banner"><a href="/kakao?from=dm">카톡방</a></div>
      <p>사람보다 <strong>평균 49%</strong> 더 자주 편을 들었다(<a href="https://news.stanford.edu/stories/2026/03/ai-advice-sycophantic-models-research">Stanford Report</a>).</p>
      <p><a href="https://github.com/karpathy/llm-council">LLM 카운슬</a> 구조다.</p>
      <h2><span class="n">STEP 1 · 1분</span>카운슬 프롬프트를 붙여 넣는다</h2>
      <pre>## 역할
너는 내 개인 의사결정 회의를 운영한다.
1. 무엇을 결정해야 하나?</pre>
      <pre>방금 결론으로 사전 부검을 해 줘.</pre>
    </div></article>
  </body></html>`;
  const markdown = articleMarkdownFromHtml(html, COUNCIL_URL, COUNCIL_TITLE);
  assert.match(markdown, new RegExp(`^# ${COUNCIL_TITLE}\\n`));
  assert.match(markdown, /```\n## 역할\n너는 내 개인 의사결정 회의를 운영한다\./);
  assert.match(markdown, /1\. 무엇을 결정해야 하나\?/);
  assert.match(markdown, /사전 부검/);
  assert.match(markdown, /## STEP 1 · 1분 카운슬 프롬프트를 붙여 넣는다/);
  assert.match(
    markdown,
    /\[Stanford Report\]\(https:\/\/news\.stanford\.edu\/stories\/2026\/03\/ai-advice-sycophantic-models-research\)/
  );
  assert.match(markdown, /\[LLM 카운슬\]\(https:\/\/github\.com\/karpathy\/llm-council\)/);
  assert.equal(markdown.includes("카톡방"), false);
  assert.equal(markdown.includes("from=dm"), false);
  const fenceStart = markdown.indexOf("```\n## 역할");
  const fenceEnd = markdown.indexOf("```", fenceStart + 3);
  const inside = markdown.slice(fenceStart, fenceEnd);
  assert.equal(/^## 역할/m.test(markdown.slice(0, fenceStart)), false);
  assert.match(inside, /## 역할/);
});
