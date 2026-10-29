// 심팀장 자료실 카드 파싱과 본문 추출을 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractShimMarkdown, parseShimIndex } from "../scripts/fetch-shim-guides.mjs";

const MOVE_URL = "https://shimteamjjang.vercel.app/move";

test("추출 스크립트 첫 줄은 한글 역할 주석이다", () => {
  const first = readFileSync(new URL("../scripts/fetch-shim-guides.mjs", import.meta.url), "utf8").split(/\r?\n/, 1)[0];
  assert.match(first, /^\/\/ .*[가-힣].+/);
  assert.equal(first.endsWith(":"), false);
});

test("홈 카드 둘은 문서 순서와 제목, 편수, 요약, 출처를 가진다", () => {
  const guides = parseShimIndex(`
    <a class="card" href="https://example.com/out"><p class="t">외부</p><span class="ep">1편</span></a>
    <a class="card" href="/"><p class="t">홈</p></a>
    <a class="card" href="/rea">
      <span class="ep">64편</span>
      <p class="t">제목   하나</p>
      <p class="d">요약   문장</p>
      <p class="go">보러 가기 →</p>
    </a>
    <a class="card" href="/weekend">
      <span class="ep">60편</span>
      <p class="t">주말에 클로드로 만들어 볼 프로젝트 5개</p>
      <p class="d">요약 둘</p>
      <p class="go">보러 가기</p>
    </a>
  `);
  assert.equal(guides.length, 2);
  assert.equal(guides[0].slug, "rea");
  assert.equal(guides[0].title, "제목 하나");
  assert.equal(guides[0].episode, "64편");
  assert.equal(guides[0].summary, "요약 문장");
  assert.equal(guides[0].summary.includes("보러 가기"), false);
  assert.equal(guides[0].order, 0);
  assert.equal(guides[0].sourceUrl, "https://shimteamjjang.vercel.app/rea");
  assert.equal(guides[1].slug, "weekend");
  assert.equal(guides[1].title, "주말에 클로드로 만들어 볼 프로젝트 5개");
  assert.equal(guides[1].episode, "60편");
  assert.equal(guides[1].order, 1);
  assert.equal(guides[1].sourceUrl, "https://shimteamjjang.vercel.app/weekend");
  assert.equal(guides[1].summary.includes("보러 가기"), false);
});

test("본문은 wrap만 남기고 복사 버튼 없이 코드, 이미지, 링크, 제목, 바닥 글을 지킨다", () => {
  const markdown = extractShimMarkdown(
    `<meta property="og:image" content="https://shimteamjjang.vercel.app/og-home.png">
    <img src="/og-clone.png" alt="카드">
    <button class="copy">복사</button>
    <div class="wrap">
      <img src="/team.png" alt="심팀장님 캐릭터">
      <img src="s1_설정메모리.png" alt="메모리]">
      <img src="/rug/gh-2-releases.png" alt="릴리스">
      <h1>주말에 클로드로<br>만들어 볼 <span class="hl">다섯 개</span></h1>
      <p><a href="https://example.com/path?utm_source=news&amp;fbclid=abc&amp;id=7">링크</a></p>
      <p><a href="http://localhost:3000/dev?utm_source=local">로컬</a></p>
      <div class="copywrap"><button class="copy">복사</button><pre>node -v</pre></div>
      <footer><p>심팀장님 · AI 자료실</p></footer>
    </div>`,
    MOVE_URL
  );
  assert.match(markdown, /```\nnode -v\n```/);
  assert.equal(markdown.includes("복사"), false);
  assert.equal(markdown.includes("og-home.png"), false);
  assert.equal(markdown.includes("og-clone.png"), false);
  assert.match(markdown, /!\[심팀장님 캐릭터\]\(https:\/\/shimteamjjang\.vercel\.app\/team\.png\)/);
  assert.match(markdown, /https:\/\/shimteamjjang\.vercel\.app\/move\/s1_설정메모리\.png/);
  assert.equal(markdown.includes("https://shimteamjjang.vercel.app/s1_설정메모리.png"), false);
  assert.match(markdown, /https:\/\/shimteamjjang\.vercel\.app\/rug\/gh-2-releases\.png/);
  assert.match(markdown, /https:\/\/example\.com\/path\?id=7/);
  assert.equal(markdown.includes("utm_source"), false);
  assert.equal(markdown.includes("fbclid"), false);
  assert.match(markdown, /http:\/\/localhost:3000\/dev/);
  assert.match(markdown, /^# 주말에 클로드로 만들어 볼 다섯 개$/m);
  assert.match(markdown, /심팀장님 · AI 자료실/);
});

test(".wrap이 없으면 실패한다", () => {
  assert.throws(() => extractShimMarkdown("<article><p>없음</p></article>", MOVE_URL));
});
