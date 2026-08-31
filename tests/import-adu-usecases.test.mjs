// ADU 클로드 업무 사례 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SITES,
  isDuplicatePage,
  parseUsecaseHtml,
  sectionCategory,
  stripTracking,
} from "../scripts/import-adu-usecases.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-adu-usecases.mjs"
);

const SOURCE = "https://adu-usecases-1.vercel.app/";

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>클로드 업무 사례 1편 — 사무직 공통편 48개 | ADU</title>
  </head>
  <body>
    <div class="wrap">
      <header class="hero">
        <span class="kicker">ADU AI 실전 노트 · 1편</span>
        <h1>클로드 업무 사례 48개<br /><em>사무직 공통편</em></h1>
        <p class="sub">회사 다니면서 매주 반복하는 일부터 넣었습니다.</p>
        <p class="meta">2026년 8월 30일 기준 · @adu.aihub</p>
      </header>
      <div class="booknav">
        <span class="cur">1편 사무직 공통편</span>
        <a href="https://adu-usecases-2.vercel.app/?utm_source=x&fbclid=Iw">2편 직무 실무편</a>
        <a href="https://adu-usecases-3.vercel.app">3편 개인·교육·비영리편</a>
      </div>
      <section>
        <h2>📌 쓰는 법</h2>
        <p class="lead">대괄호 안만 내 상황으로 바꿔서 던지면 됩니다.</p>
        <div class="callout c-warn">
          <span class="ct">⚠️ 넘기기 전에</span>
          보내기와 게시와 결제가 들어간 작업은 초안까지만 시키세요.
        </div>
      </section>
      <nav class="navbar">
        <div class="inner">
          <button class="fbtn on">전체 2</button>
          <button class="fbtn">필터전용칩</button>
        </div>
      </nav>
      <section id="g1">
        <h2>🧰 업무 공통<span class="cnt">19개</span></h2>
        <div class="uc">
          <span class="tag">채팅</span>
          <h4>내 직무에 맞는 활용법 받기</h4>
          <p>클로드를 처음 켠 날 여기서 시작합니다.</p>
          <div class="promptbox">
            <button class="copybtn">복사</button>
            <pre>나는 [회사 규모]에서 [직무]를 맡고 있습니다.
활용법 다섯 개를 알려주세요.</pre>
          </div>
        </div>
      </section>
      <section id="g2">
        <h2>💰 재무·회계<span class="cnt">18개</span></h2>
        <div class="uc">
          <span class="tag b">코워크</span>
          <h4>월마감 초안</h4>
          <p>숫자 파일을 읽고 마감 초안을 만듭니다.</p>
          <div class="promptbox">
            <button class="copybtn">복사</button>
            <pre>이번 달 마감 초안을 만들어줘.</pre>
          </div>
        </div>
      </section>
      <section>
        <h2>🧭 막혔을 때</h2>
        <details>
          <summary>코워크가 안 보입니다</summary>
          <p>코워크는 데스크톱 앱의 유료 플랜 기능입니다.</p>
        </details>
      </section>
      <div class="cta">
        <h2>이런 정리를 계속 받고 싶다면</h2>
        <p>오픈채팅방에서 먼저 공유드립니다.</p>
        <a href="https://open.kakao.com/o/gyxoUeLi?utm_campaign=x">ADU 오픈채팅방 입장하기</a>
      </div>
    </div>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// ADU 클로드 업무 사례 3편을 Pages와 Prompts에 저장한다"
  );
});

test("SITES 기대 프롬프트 수는 48, 64, 36이다", () => {
  assert.deepEqual(
    SITES.map((site) => site.expectedPrompts),
    [48, 64, 36]
  );
  assert.equal(SITES[0].url, "https://adu-usecases-1.vercel.app/");
  assert.equal(SITES[1].url, "https://adu-usecases-2.vercel.app/");
  assert.equal(SITES[2].url, "https://adu-usecases-3.vercel.app/");
});

test("sectionCategory는 이모지와 개수 접미를 뺀다", () => {
  assert.equal(sectionCategory("🧰 업무 공통19개"), "ADU · 업무 공통");
  assert.equal(sectionCategory("💰 재무·회계18개"), "ADU · 재무·회계");
  assert.equal(sectionCategory("🏠 개인·일상18개"), "ADU · 개인·일상");
});

test("parseUsecaseHtml은 카드 두 개를 분류와 원문 그대로 뽑는다", () => {
  const parsed = parseUsecaseHtml(FIXTURE, SOURCE);
  assert.equal(parsed.title, "클로드 업무 사례 1편 — 사무직 공통편 48개");
  assert.equal(parsed.prompts.length, 2);
  assert.equal(parsed.prompts[0].title, "내 직무에 맞는 활용법 받기");
  assert.equal(parsed.prompts[0].category, "ADU · 업무 공통");
  assert.equal(parsed.prompts[0].summary, "클로드를 처음 켠 날 여기서 시작합니다.");
  assert.equal(
    parsed.prompts[0].when_to_use,
    "채팅에서 씁니다. 클로드를 처음 켠 날 여기서 시작합니다."
  );
  assert.equal(
    parsed.prompts[0].body,
    "나는 [회사 규모]에서 [직무]를 맡고 있습니다.\n활용법 다섯 개를 알려주세요."
  );
  assert.equal(parsed.prompts[1].title, "월마감 초안");
  assert.equal(parsed.prompts[1].category, "ADU · 재무·회계");
  assert.equal(parsed.prompts[1].body, "이번 달 마감 초안을 만들어줘.");
  const sections = JSON.parse(parsed.prompts[0].sections);
  assert.equal(sections[0].title, "프롬프트");
  assert.equal(sections[0].body, parsed.prompts[0].body);
  assert.equal(sections[1].body, "채팅");
  assert.equal(sections[2].body, SOURCE);
  assert.equal(parsed.markdown.includes(`> 원문. [ADU 1편 사무직 공통편](${SOURCE})`), true);
  assert.equal(parsed.markdown.includes("## 막혔을 때"), true);
  assert.equal(parsed.markdown.includes("### 코워크가 안 보입니다"), true);
  assert.equal(parsed.markdown.includes("코워크는 데스크톱 앱의 유료 플랜 기능입니다."), true);
  assert.equal(parsed.markdown.includes("## 쓰는 법"), true);
  assert.equal(parsed.markdown.includes("넘기기 전에"), true);
  assert.equal(parsed.markdown.includes("복사"), false);
  assert.equal(parsed.markdown.includes("필터전용칩"), false);
  assert.equal(parsed.markdown.includes("전체 2"), false);
  assert.equal(parsed.markdown.includes("utm_"), false);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("https://adu-usecases-2.vercel.app/"), true);
  assert.equal(
    parsed.markdown.includes("https://open.kakao.com/o/gyxoUeLi"),
    true
  );
});

test("isDuplicatePage는 제목 또는 원문 주소면 true다", () => {
  const title = "클로드 업무 사례 1편 — 사무직 공통편 48개";
  assert.equal(isDuplicatePage({ title, content: "" }, title, SOURCE), true);
  assert.equal(
    isDuplicatePage({ title: "다른 글", source_url: SOURCE, content: "" }, title, SOURCE),
    true
  );
  assert.equal(
    isDuplicatePage(
      { title: "다른 글", content: `원문. [ADU 1편 사무직 공통편](${SOURCE})` },
      title,
      SOURCE
    ),
    true
  );
  assert.equal(
    isDuplicatePage(
      { title: "다른 글", content: `북내비만 ${SOURCE}` },
      title,
      SOURCE
    ),
    false
  );
  assert.equal(
    isDuplicatePage({ title: "다른 글", content: "없음" }, title, SOURCE),
    false
  );
});

test("stripTracking은 샘플 주소를 깨끗이 남긴다", () => {
  assert.equal(
    stripTracking("https://adu-usecases-2.vercel.app/?utm_source=x&fbclid=Iw"),
    "https://adu-usecases-2.vercel.app/"
  );
  assert.equal(
    stripTracking("https://open.kakao.com/o/gyxoUeLi?utm_campaign=a"),
    "https://open.kakao.com/o/gyxoUeLi"
  );
  assert.equal(
    stripTracking("https://adu-usecases-1.vercel.app/"),
    "https://adu-usecases-1.vercel.app/"
  );
});
