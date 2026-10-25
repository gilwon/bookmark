// 심팀장 주말 클로드 5개 글 이관을 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  WEEKEND_TITLE,
  WEEKEND_URL,
  isDuplicateRow,
  presenceAction,
  stripTracking,
  weekendMarkdownFromHtml,
} from "../scripts/import-shim-weekend.mjs";

const SCRIPT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/import-shim-weekend.mjs");
const TRACKING_KEY = ["fb", "clid"].join("");
const PNG = "data:image/png;base64,iVBORw0KGgo=";

const WEEKEND_HTML = `<!doctype html>
<html><head>
<meta property="og:image" content="https://shimteamjjang.vercel.app/og-weekend.png">
<title>주말에 클로드로 만들어 볼 5개 · 심팀장</title>
</head><body>
<div class="wrap">
  <header>
    <img src="${PNG}" alt="심팀장님 캐릭터">
    <h1>주말에 클로드로<br>만들어 볼 <span class="hl">다섯 개</span></h1>
    <p class="sub">에이전트 팀 · 웹사이트 · 세컨드 브레인 · 대시보드 · 주간 회고</p>
  </header>
  <div class="callout">💡 영상에서 말한 다섯 가지를 <b>시킬 문장 예시</b>로 정리했어요.</div>
  <h2>📦 한눈에</h2>
  <table class="tbl">
    <tr><th>번호</th><th>무엇을 만드나</th></tr>
    <tr><td>① 에이전트 팀</td><td>콘텐츠 만드는 일을 역할을 나눠서 맡기는 팀</td></tr>
  </table>
  <h2>🛠 시킬 문장 예시</h2>
  <div class="copywrap">
    <pre>나는 [내 분야] 콘텐츠를 만들어. 잘 된 글감을 찾아 모으는 역할, 이미지와 릴스 초안을 만드는 역할, 올릴 글을 정리하는 역할로 나눠서 일할 팀을 같이 설계해 줘. 먼저 역할과 순서만 표로 보여 줘.</pre>
    <button type="button">복사</button>
  </div>
  <pre>내 경력과 하고 싶은 일을 소개하는 웹사이트를 한 페이지로 만들어 줘.</pre>
  <pre>이 폴더 안의 문서와 메모를 주제별로 나눠서 한 폴더에 모아 줘.</pre>
  <pre>내 할 일과 돈 관리를 한 화면에서 보는 대시보드를 만들어 줘.</pre>
  <pre>지난 일주일 동안 나와 나눈 대화를 돌아보고, 잘한 것, 못한 것, 새로 만들면 좋을 자동화를 알려 주는 에이전트를 만들고 싶어.</pre>
  <h2>⚠️ 꼭 알아둘 것</h2>
  <p><b>① 영상 속 말</b>. 시작점으로 쓰는 <b>예시 문장</b>이다.</p>
  <div class="cta"><p>인스타 <b>심팀장님</b> 팔로우 해주세요</p></div>
  <footer><p>이 자료는 해외 크리에이터 영상의 소개 내용을 바탕으로 정리한 것이고 직접 실행해 확인한 것은 아니에요.</p></footer>
  <a href="https://example.com/note?${TRACKING_KEY}=abc&amp;utm_source=ig">메모</a>
</div>
<img src="https://shimteamjjang.vercel.app/og-weekend.png" alt="card">
</body></html>`;

test("스크립트는 Pages에만 넣고 기존 행은 고치지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes(TRACKING_KEY), false);
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("이번 실행에서 넣은 로컬 행만 지운다. 원래 있던 행은 남긴다."), true);
  assert.equal(WEEKEND_URL.includes("?"), false);
  assert.equal(WEEKEND_URL.includes(TRACKING_KEY), false);
});

test("원문 주소에서 추적 쿼리만 뺀다", () => {
  const messy = `${WEEKEND_URL}?${TRACKING_KEY}=abc&utm_source=ig&gclid=1&from=littly&from=dm&m=1&source=copy_link&pvs=1&igsh=1&mcp_token=1`;
  assert.equal(stripTracking(messy), WEEKEND_URL);
  assert.equal(stripTracking("http://example.com/a"), "https://example.com/a");
  assert.equal(stripTracking("http://localhost/keep"), "http://localhost/keep");
  assert.equal(stripTracking("http://127.0.0.1/keep"), "http://127.0.0.1/keep");
  assert.equal(stripTracking(PNG), PNG);
});

test("같은 제목이나 같은 원문만 중복이고 한쪽만 있으면 넣지 않는다", () => {
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: "https://example.com/other" }, WEEKEND_TITLE, [WEEKEND_URL]),
    false
  );
  assert.equal(
    isDuplicateRow({ title: WEEKEND_TITLE, source_url: "https://example.com/other" }, WEEKEND_TITLE, [WEEKEND_URL]),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: WEEKEND_URL }, WEEKEND_TITLE, [WEEKEND_URL]),
    true
  );
  assert.equal(presenceAction(false, false), "import");
  assert.equal(presenceAction(true, true), "skip");
  assert.equal(presenceAction(true, false), "split");
  assert.equal(presenceAction(false, true), "split");
});

test("주말 글 변환은 캐릭터 그림과 표와 예시 문장 다섯 개를 남긴다", () => {
  const markdown = weekendMarkdownFromHtml(WEEKEND_HTML);
  assert.equal(markdown.startsWith(`# ${WEEKEND_TITLE}`), true);
  assert.equal(markdown.includes("만들어 볼 5개"), false);
  assert.equal(/^복사$/m.test(markdown), false);
  assert.equal(markdown.includes("og-weekend.png"), false);
  assert.match(markdown, /^!\[심팀장님 캐릭터\]\(data:image\/png;base64,iVBORw0KGgo=\)$/m);
  assert.equal(markdown.includes("에이전트 팀 · 웹사이트 · 세컨드 브레인 · 대시보드 · 주간 회고"), true);
  assert.match(markdown, /\| 번호 \| 무엇을 만드나 \|/);
  assert.match(markdown, /\| ① 에이전트 팀 \| 콘텐츠 만드는 일을 역할을 나눠서 맡기는 팀 \|/);
  assert.equal(markdown.split("```").length - 1, 10);
  assert.match(
    markdown,
    /```\n나는 \[내 분야\] 콘텐츠를 만들어\. 잘 된 글감을 찾아 모으는 역할, 이미지와 릴스 초안을 만드는 역할, 올릴 글을 정리하는 역할로 나눠서 일할 팀을 같이 설계해 줘\. 먼저 역할과 순서만 표로 보여 줘\.\n```/
  );
  assert.equal(markdown.includes("내 경력과 하고 싶은 일을 소개하는 웹사이트를 한 페이지로 만들어 줘."), true);
  assert.equal(markdown.includes("지난 일주일 동안 나와 나눈 대화를 돌아보고"), true);
  assert.equal(markdown.includes("팔로우 해주세요"), true);
  assert.equal(
    markdown.includes("이 자료는 해외 크리에이터 영상의 소개 내용을 바탕으로 정리한 것이고 직접 실행해 확인한 것은 아니에요."),
    true
  );
  assert.equal(markdown.includes("https://example.com/note"), true);
  assert.equal(markdown.includes(TRACKING_KEY), false);
  assert.equal(markdown.includes("utm_source"), false);
  assert.equal(markdown.includes(WEEKEND_URL), true);
});
