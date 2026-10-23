// every._ai k-skill 131개 가이드 이관 헬퍼를 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_TITLE,
  SOURCE_URL,
  articleMarkdownFromHtml,
} from "../scripts/import-every-ai-k-skill-131-20261021.mjs";

test("k-skill 본문은 표와 코드와 링크를 남기고 홍보를 뺀다", () => {
  const html = `<!doctype html><html><body>
    <article class="post"><div class="wrap">
      <h1><em>한국인이면 무조건 쓰게 될</em> k-skill 131개 설치 가이드</h1>
      <div class="sub"><span>읽는 데 8분</span><span>2026-10-21 공개</span></div>
      <div class="challenge-post-banner">
        <span>every._ai 수익화 노하우</span>
        <a href="/kakao?from=guide-top">카톡방</a>
      </div>
      <h2><span class="n">STEP 1 · 1분</span>클로드 코드에 k-skill 마켓플레이스를 등록한다</h2>
      <pre>/plugin marketplace add NomaDamas/k-skill</pre>
      <pre>/plugin install k-skill@k-skill</pre>
      <p><code>npx --yes skills add NomaDamas/k-skill --all -g</code></p>
      <p>real-estate-search로 시세를 본다. 이동·교통·여행 분야도 있다.</p>
      <table>
        <tr><th>분야</th><th>스킬 수</th></tr>
        <tr><td>이동·교통·여행</td><td>18</td></tr>
      </table>
      <table>
        <tr><th>분야</th><th>스킬 이름</th></tr>
        <tr><td>부동산</td><td>real-estate-search</td></tr>
      </table>
      <ul>
        <li><a href="https://github.com/NomaDamas/k-skill">저장소</a></li>
        <li><a href="https://github.com/NomaDamas/k-skill/blob/main/docs/install.md">설치</a></li>
        <li><a href="https://github.com/NomaDamas/k-skill/blob/main/docs/setup.md">설정</a></li>
        <li><a href="https://code.claude.com/docs/en/plugin-marketplaces">마켓플레이스</a></li>
        <li><a href="https://code.claude.com/docs/en/skills">스킬</a></li>
      </ul>
      <h2>함께 보면 좋은 글</h2>
      <ul><li><a href="/posts/claude-skills-388-staff">다른 글</a></li></ul>
      <a class="kakao-post-cta" href="/kakao?from=guide">카톡방</a>
    </div></article>
    <footer><a href="https://instagram.com/every._ai">@every._ai</a></footer>
  </body></html>`;
  const markdown = articleMarkdownFromHtml(html);
  assert.match(markdown, new RegExp(`^# ${PAGE_TITLE}\\n`));
  assert.match(markdown, new RegExp(`> 원문\\. \\[every\\._ai\\]\\(${SOURCE_URL.replace(/[.]/g, "\\.")}\\)`));
  assert.match(markdown, /읽는 데 8분 2026-10-21 공개/);
  assert.match(markdown, /## STEP 1 · 1분 클로드 코드에 k-skill 마켓플레이스를 등록한다/);
  assert.match(markdown, /```\n\/plugin marketplace add NomaDamas\/k-skill\n```/);
  assert.match(markdown, /\| 분야 \| 스킬 수 \|/);
  assert.match(markdown, /\| 이동·교통·여행 \| 18 \|/);
  assert.match(markdown, /\| --- \| --- \|/);
  assert.match(markdown, /\[저장소\]\(https:\/\/github\.com\/NomaDamas\/k-skill\)/);
  assert.match(markdown, /\[스킬\]\(https:\/\/code\.claude\.com\/docs\/en\/skills\)/);
  for (const snippet of [
    "수익화 노하우",
    "카톡방",
    "함께 보면 좋은 글",
    "claude-skills-388-staff",
    "instagram.com/every",
    "from=guide",
  ]) {
    assert.equal(markdown.includes(snippet), false, snippet);
  }
});
