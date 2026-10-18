// 스케일메이커 에이전트 뷰와 레플리카 복제 글 이관을 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CLONE_TITLE,
  CLONE_URL,
  SCALE_TITLE,
  SCALE_URL,
  cloneMarkdownFromHtml,
  isDuplicateRow,
  scaleMarkdownFromHtml,
  stripTracking,
} from "../scripts/import-scalemaker-agent-view-replica.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-scalemaker-agent-view-replica.mjs"
);
const TRACKING_KEY = ["fb", "clid"].join("");

const SCALE_HTML = `<!doctype html>
<html><body>
<header><img src="/brand/logo-ko.svg" alt="logo"></header>
<main>
  <p>@ai_leeseul 정리본 · 2026-10-14</p>
  <h1>클로드코드 에이전트 뷰(claude agents): 클로드 여러 명에게 동시에 일 맡기기</h1>
  <ol>
    <li>
      <span>01</span>
      <h2>1. 에이전트 뷰 열기</h2>
      <div><span>프롬프트</span><button type="button">복사</button></div>
      <pre>claude agents</pre>
    </li>
  </ol>
  <p>2026. 10. 14. 메모</p>
  <p>http://example.com/guide</p>
  <pre>http://localhost/keep</pre>
  <a href="/courses">강의 둘러보기</a>
  <a href="https://www.instagram.com/ai_leeseul/">@ai_leeseul 팔로우</a>
</main>
<footer><a href="https://pf.kakao.com/x">이용약관</a><a href="https://www.youtube.com/">Youtube</a></footer>
</body></html>`;

const CLONE_HTML = `<!doctype html>
<html><body>
<div class="wrap">
  <header>
    <img src="data:image/png;base64,iVBORw0KGgo=" alt="심팀장님 캐릭터">
    <h1>클로드로 돈 내던 앱<br><span class="hl">복제</span>하기</h1>
    <p class="sub">레플리카 스킬 11개 · 설치 한 줄 · 쓰는 순서 · 꼭 알아둘 것</p>
  </header>
  <div class="copywrap"><button class="copy">복사</button><pre>https://github.com/Jakeschincariol/replica-skill

install skill</pre></div>
  <table class="tbl">
    <tr><th>명령</th><th>하는 일</th></tr>
    <tr><td>/replica-recon</td><td>앱을 뜯어봐요. <b>여기에 앱 주소를 넣고 시작</b></td></tr>
  </table>
  <p><a href="https://github.com/Jakeschincariol/replica-skill">원문</a></p>
  <footer><p>참고: replica-skill README · 2026-10-09 확인.</p></footer>
</div>
<img src="https://shimteamjjang.vercel.app/og-clone.png" alt="card">
</body></html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 스케일메이커 에이전트 뷰와 레플리카 복제 글을 Pages에만 저장한다."
  );
  assert.equal(source.includes(TRACKING_KEY), false);
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(
    source.includes("이번 실행에서 넣은 로컬 행만 지운다. 원래 있던 행은 남긴다."),
    true
  );
});

test("원문 주소에는 쿼리가 없다", () => {
  assert.equal(SCALE_URL.includes("?"), false);
  assert.equal(CLONE_URL.includes("?"), false);
  assert.equal(SCALE_URL.includes(TRACKING_KEY), false);
  assert.equal(CLONE_URL.includes(TRACKING_KEY), false);
  const messy = `${SCALE_URL}?${TRACKING_KEY}=abc&utm_source=ig&gclid=1&from=littly&from=dm&m=1&source=copy_link&pvs=1&igsh=1&mcp_token=1`;
  assert.equal(stripTracking(messy), SCALE_URL);
  assert.equal(stripTracking("http://example.com/a"), "https://example.com/a");
  assert.equal(stripTracking("http://localhost/keep"), "http://localhost/keep");
  assert.equal(stripTracking("http://127.0.0.1/keep"), "http://127.0.0.1/keep");
  assert.equal(stripTracking("data:image/png;base64,aaa"), "data:image/png;base64,aaa");
});

test("같은 제목이나 같은 원문만 중복이다", () => {
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: "https://example.com/other" }, SCALE_TITLE, [
      SCALE_URL,
    ]),
    false
  );
  assert.equal(
    isDuplicateRow({ title: SCALE_TITLE, source_url: "https://example.com/other" }, SCALE_TITLE, [
      SCALE_URL,
    ]),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: CLONE_URL }, CLONE_TITLE, [CLONE_URL]),
    true
  );
});

test("스케일메이커 변환은 로고와 복사 버튼을 버리고 코드와 강의 링크와 날짜를 남긴다", () => {
  const markdown = scaleMarkdownFromHtml(SCALE_HTML);
  assert.equal(markdown.startsWith(`# ${SCALE_TITLE}`), true);
  assert.equal(markdown.includes("/brand/logo"), false);
  assert.equal(markdown.includes("복사"), false);
  assert.equal(markdown.includes("프롬프트"), false);
  assert.equal(markdown.includes("이용약관"), false);
  assert.equal(markdown.includes("youtube.com"), false);
  assert.equal(/^01$/m.test(markdown), false);
  assert.match(markdown, /^## 1\. 에이전트 뷰 열기$/m);
  assert.match(markdown, /```\nclaude agents\n```/);
  assert.equal(markdown.includes("https://scalemaker.co/courses"), true);
  assert.equal(markdown.includes("https://www.instagram.com/ai_leeseul/"), true);
  assert.equal(markdown.includes("https://example.com/guide"), true);
  assert.equal(markdown.includes("http://example.com"), false);
  assert.equal(markdown.includes("http://localhost/keep"), true);
  assert.equal(markdown.includes("\u200B2026. 10. 14."), true);
  assert.equal(/^2026\. 10\. 14\./m.test(markdown), false);
});

test("레플리카 변환은 캐릭터와 표와 설치 코드와 출처를 남긴다", () => {
  const markdown = cloneMarkdownFromHtml(CLONE_HTML);
  assert.equal(markdown.startsWith(`# ${CLONE_TITLE}`), true);
  assert.equal(markdown.includes("앱복제하기"), false);
  assert.equal(markdown.includes("복사"), false);
  assert.equal(markdown.includes("og-clone.png"), false);
  assert.equal(markdown.includes("data:image/png;base64,iVBORw0KGgo="), true);
  assert.equal(markdown.includes("심팀장님 캐릭터"), true);
  assert.equal(markdown.includes("레플리카 스킬 11개 · 설치 한 줄 · 쓰는 순서 · 꼭 알아둘 것"), true);
  assert.match(markdown, /\| 명령 \| 하는 일 \|/);
  assert.match(markdown, /\| \/replica-recon \|/);
  assert.equal(markdown.includes("여기에 앱 주소를 넣고 시작"), true);
  assert.match(
    markdown,
    /```\nhttps:\/\/github\.com\/Jakeschincariol\/replica-skill\n\ninstall skill\n```/
  );
  assert.equal(markdown.includes("https://github.com/Jakeschincariol/replica-skill"), true);
  assert.equal(markdown.includes("참고: replica-skill README"), true);
  assert.equal(markdown.includes("2026-10-09"), true);
  assert.equal(CLONE_TITLE, "클로드로 돈 내던 앱 복제하기");
});
