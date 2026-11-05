// 트렌드코어 랩 카드 파싱과 본문 추출을 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractLabMarkdown, parseLabIndex } from "../scripts/fetch-trendcore-lab.mjs";

const PAGE_URL = "https://www.trendcore.co.kr/guide/074";

test("추출 스크립트 첫 줄은 한글 역할 주석이고 콜론으로 끝나지 않는다", () => {
  const first = readFileSync(new URL("../scripts/fetch-trendcore-lab.mjs", import.meta.url), "utf8").split(/\r?\n/, 1)[0];
  assert.match(first, /^\/\/ .*[가-힣].+/);
  assert.equal(first.endsWith(":"), false);
  assert.equal(first.endsWith("."), true);
});

test("카드 중복은 하나이고 074와 기초첫걸음의 번호·분류·태그·날짜·주소를 읽는다", () => {
  const guides = parseLabIndex(`
    <a class="card" href="/out"><b>제외</b></a>
    <a class="card" href="/guide/074?utm_source=lab">
      <span class="h">#074<span class="new">NEW</span></span>
      <b>클로드에   SNS 채널 통째로 맡기기</b>
      <p>업리카   설명</p>
      <div class="f">11월 4일 꿀팁 · 단계 8개 · 약 10분</div>
    </a>
    <a class="card" href="/guide/074?utm_source=lab">
      <span class="h">#999</span>
      <b>중복 카드</b>
      <p>보이면 안 된다</p>
      <div class="f">11월 1일 꿀팁</div>
    </a>
    <a class="card" href="/guide/first-steps">
      <span class="h">기초첫걸음</span>
      <b>그림으로 따라 하는 블로그 첫걸음</b>
      <p>글감 찾기</p>
      <div class="f">10월 13일 · 기본 3단계 + 응용 3단계</div>
    </a>
  `);
  assert.equal(guides.length, 2);
  assert.equal(guides[0].slug, "074");
  assert.equal(guides[0].title, "클로드에 SNS 채널 통째로 맡기기");
  assert.equal(guides[0].summary, "업리카 설명");
  assert.equal(guides[0].number, "#074");
  assert.equal(guides[0].category, "꿀팁");
  assert.deepEqual(guides[0].tags, ["NEW", "단계 8개", "약 10분"]);
  assert.equal(guides[0].publishedAt, "2026-11-04T00:00:00.000Z");
  assert.equal(guides[0].sourceUrl, "https://www.trendcore.co.kr/guide/074");
  assert.equal(guides[1].slug, "first-steps");
  assert.equal(guides[1].category, "기초첫걸음");
  assert.equal(guides[1].number, "기초첫걸음");
  assert.equal(guides[1].publishedAt, "2026-10-13T00:00:00.000Z");
  assert.deepEqual(guides[1].tags, ["기본 3단계 + 응용 3단계"]);
});

test("본문은 홍보와 추적 쿼리를 빼고 이미지·pdf·코드 펜스를 절대 주소로 남긴다", () => {
  const markdown = extractLabMarkdown(
    `<main>
      <div class="top">상단 막대</div>
      <p class="lead">리드 문장</p>
      <div class="facts">사실 상자는 본문이 아니다</div>
      <a class="kko" href="https://open.kakao.com/o/abc">SNS자동화 시스템 무료강의 오픈톡에서 물어보세요</a>
      <section class="toc">목차 비밀</section>
      <div class="body">
        <div class="item">
          <div class="item-head"><div class="num">1</div><h3>연결</h3></div>
          <img src="/guide/074-assets/s1.png" alt="화면">
          <a href="/guide/074-assets/uplika-074.pdf">PDF</a>
          <a href="https://example.com/path?utm_source=news&amp;id=7">외부</a>
          <pre><code>https://api.uplika.com/mcp</code></pre>
        </div>
      </div>
      <a class="back" href="/lab">목록</a>
      <p class="foot">하단 풋터</p>
      <script>new Image().src="https://studio.trendcore.co.kr/api/lab/hit?p=074"</script>
    </main>`,
    PAGE_URL
  );
  assert.match(markdown, /https:\/\/www\.trendcore\.co\.kr\/guide\/074-assets\/s1\.png/);
  assert.match(markdown, /https:\/\/www\.trendcore\.co\.kr\/guide\/074-assets\/uplika-074\.pdf/);
  assert.match(markdown, /```\nhttps:\/\/api\.uplika\.com\/mcp\n```/);
  assert.match(markdown, /https:\/\/example\.com\/path\?id=7/);
  assert.match(markdown, /리드 문장/);
  assert.match(markdown, /1\. 연결/);
  assert.equal(markdown.includes("open.kakao.com"), false);
  assert.equal(markdown.includes("utm_source"), false);
  assert.equal(markdown.includes("SNS자동화 시스템 무료강의"), false);
  assert.equal(markdown.includes("오픈톡에서 물어보세요"), false);
  assert.equal(markdown.includes("studio.trendcore.co.kr/api/lab/hit"), false);
  assert.equal(markdown.includes("사실 상자는 본문이 아니다"), false);
  assert.equal(markdown.includes("목차 비밀"), false);
  assert.equal(markdown.includes("하단 풋터"), false);
});

test("div.body가 없으면 섹션을 읽고 빈 pre의 ${topic}은 맛집이 된다", () => {
  const markdown = extractLabMarkdown(
    `<main>
      <section class="item">
        <pre id="ideas"></pre>
        <pre id="write"></pre>
      </section>
      <script>
        const $ = id => document.getElementById(id);
        $('ideas').textContent = \`관심 분야는 ‘\${topic}’이야.\`;
        $('write').textContent = (choice ? \`‘\${choice}’ 주제로\` : '앞에서 고른 주제') + '\\n다음 문장';
        throw new Error("페이지 스크립트를 실행하면 안 된다");
      </script>
    </main>`,
    "https://www.trendcore.co.kr/guide/first-steps"
  );
  assert.match(markdown, /맛집/);
  assert.match(markdown, /앞에서 고른 주제/);
  assert.match(markdown, /다음 문장/);
  assert.equal(markdown.includes("${topic}"), false);
  assert.equal(markdown.includes("${choice}"), false);
});
