// 바이비 AI티 빼는 클로드 스킬 3종 이관을 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { documentStats } from "../scripts/import-claude-eli5-page.mjs";
import {
  ATTACHMENT_SOURCE_ID,
  EXPECTED_ATTACHMENTS,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  PAGE_TITLE,
  SOURCE_URL,
  ZIP_FILES,
  attachmentHref,
  isDuplicateRow,
  parseVaigentAntiAiHtml,
  stripTracking,
  toPageDocument,
  verifyVaigentAntiAiZip,
} from "../scripts/import-vaigent-anti-ai-writing-skill.mjs";

const OTHER_TITLE = "개발자 2.8만명이 선택한 AI디자인 치트키";
const OTHER_URL = "https://www.withvaigent.com/blog/ui-ux-pro-max-skill";
const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-vaigent-anti-ai-writing-skill.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>글쓸 때 AI티 빼는 클로드 스킬 3종 세트 · 바이비</title>
  </head>
  <body>
    <header><a href="/blog/ui-ux-pro-max-skill?fbclid=header">헤더 크롬</a></header>
    <article class="post">
      <header class="post__head"><h1>글쓸 때 AI티 빼는 클로드 스킬 3종 세트</h1></header>
      <div class="post__layout">
        <nav class="sidebar"><a href="/blog/natural-camera-angle-prompts">사이드바 다른 글</a></nav>
        <div class="post__body">
          <p><a href="http://human-ai-writing.vercel.app/?utm_source=share&amp;fbclid=abc&amp;source=copy_link">사람냄새나는 AI글쓰기 실전 노하우</a></p>
          <table>
            <thead><tr><th>스킬</th><th>하는 일</th><th>이럴 때 쓰면 좋아요</th></tr></thead>
            <tbody>
              <tr><td>humanize-korean</td><td>한국어 글의 번역투와 AI 관용구를 찾아 고쳐요</td><td>번역투가 보일 때</td></tr>
              <tr><td>anti-ai-writing</td><td>막연하고 부풀린 표현을 구체적인 사례와 숫자로 바꿔요</td><td>남는 게 없을 때</td></tr>
              <tr><td>voice-dna</td><td>내가 쓴 글을 분석해서 어떤 글이든 내 말투로 바꿔요</td><td>내 글 같지 않을 때</td></tr>
            </tbody>
          </table>
          <h4 id="파일-받기"><a href="#파일-받기">📥 파일 받기</a></h4>
          <p class="file-download"><a href="/images/3e6f2254-ee13-802e-9444-e7fd6a7f0458/3e6f2254-ee13-80b6-8e67-d44bdbc69a1a-3144992b8c22/humanize-korean.zip"><span>⬇</span> humanize-korean.zip<span class="file-download__size">18KB</span></a></p>
          <p class="file-download"><a href="/images/3e6f2254-ee13-802e-9444-e7fd6a7f0458/3e6f2254-ee13-8093-9260-c2344cec3044-f12cec2833a3/anti-ai-writing.zip">⬇ anti-ai-writing.zip6KB</a></p>
          <p class="file-download"><a href="/images/3e6f2254-ee13-802e-9444-e7fd6a7f0458/3e6f2254-ee13-8058-b607-d22f0af3b8a4-33a6e969b3a6/voice-dna-maker.zip?utm_source=file&amp;fbclid=zip">voice-dna-maker.zip</a></p>
          <p><a href="https://github.com/epoko77-ai/im-not-ai?utm_source=gh&amp;fbclid=gh">im-not-ai</a></p>
          <p><a href="https://github.com/artemnovitckii/content-skills">content-skills</a></p>
          <p><a href="https://open.kakao.com/o/gie1t2Hi?fbclid=kakao">오픈 채팅방 참여하기</a></p>
          <ul class="tag-list"><li><a href="/blog/tag/skill?fbclid=tag">태그 크롬</a></li></ul>
        </div>
      </div>
    </article>
    <section class="related">
      <h2>관련 글</h2>
      <a href="/blog/ui-ux-pro-max-skill">개발자 2.8만명이 선택한 AI디자인 치트키</a>
      <a href="/blog/ai-티-안나게-글쓰기">글쓸 때 AI 티 안나게 하는 꿀팁</a>
      <a href="/blog/natural-camera-angle-prompts">자연스러운 카메라 앵글</a>
    </section>
    <footer>푸터 크롬</footer>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.split("\n")[0], "// 바이비 AI티 빼는 클로드 스킬 3종을 Pages에만 저장한다");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("assertDownloadableAttachment"), false);
  assert.equal(source.includes("data:application/zip;base64"), false);
});

test("제목과 저장 URL에서 사이트 접미와 fbclid를 뺀다", () => {
  assert.equal(PAGE_TITLE, "글쓸 때 AI티 빼는 클로드 스킬 3종 세트");
  assert.equal(PAGE_TITLE.includes("바이비"), false);
  assert.equal(SOURCE_URL, "https://www.withvaigent.com/blog/anti-ai-writing-skill");
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(ATTACHMENT_SOURCE_ID, "withvaigent-anti-ai-writing");
  assert.equal(EXPECTED_IMAGES, 0);
  assert.equal(EXPECTED_ATTACHMENTS, 3);
  assert.equal(EXPECTED_TABLES, 1);
  assert.equal(
    stripTracking("http://human-ai-writing.vercel.app/?utm_source=share&fbclid=abc&source=copy_link"),
    "https://human-ai-writing.vercel.app/"
  );
  assert.equal(stripTracking("#파일-받기"), "#파일-받기");
  assert.equal(
    stripTracking(attachmentHref("humanize-korean.zip")),
    "/api/page-attachments/withvaigent-anti-ai-writing/humanize-korean.zip"
  );
});

test("parseVaigentAntiAiHtml은 본문 링크만 남기고 관련 글과 태그를 뺀다", () => {
  const dirty = `${SOURCE_URL}?fbclid=IwAR123&utm_source=share`;
  const parsed = parseVaigentAntiAiHtml(FIXTURE, dirty);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(parsed.markdown.includes("· 바이비"), false);
  assert.equal(parsed.markdown.includes(`> 원문. [바이비](${SOURCE_URL})`), true);
  for (const href of [
    "https://human-ai-writing.vercel.app/",
    "https://github.com/epoko77-ai/im-not-ai",
    "https://github.com/artemnovitckii/content-skills",
    "https://open.kakao.com/o/gie1t2Hi",
  ]) {
    assert.equal(parsed.markdown.includes(href), true, href);
  }
  for (const file of ZIP_FILES) {
    const href = attachmentHref(file.filename);
    assert.equal(href, `/api/page-attachments/withvaigent-anti-ai-writing/${encodeURIComponent(file.filename)}`);
    assert.equal(parsed.markdown.includes(`[${file.filename}](${href})`), true, file.filename);
  }
  assert.equal(parsed.markdown.includes("#파일-받기"), true);
  assert.equal(parsed.markdown.includes("humanize-korean"), true);
  assert.equal(parsed.markdown.includes("anti-ai-writing"), true);
  assert.equal(parsed.markdown.includes("voice-dna"), true);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes("관련 글"), false);
  assert.equal(parsed.markdown.includes("/blog/ui-ux-pro-max-skill"), false);
  assert.equal(parsed.markdown.includes("ai-티-안나게"), false);
  assert.equal(parsed.markdown.includes("natural-camera-angle-prompts"), false);
  assert.equal(parsed.markdown.includes("/images/3e6f2254-ee13-802e-9444-e7fd6a7f0458/"), false);
  assert.equal(parsed.markdown.includes("태그 크롬"), false);
  assert.equal(parsed.markdown.includes("헤더 크롬"), false);
  assert.equal(parsed.markdown.includes("푸터 크롬"), false);
  assert.equal(parsed.markdown.includes("사이드바 다른 글"), false);
  assert.equal(parsed.markdown.includes("18KB"), false);
  assert.equal(parsed.markdown.includes("data:"), false);
  const content = toPageDocument(parsed.markdown);
  const stats = documentStats(content);
  assert.equal(stats.images, 0);
  assert.equal(stats.attachments, 3);
  assert.equal(stats.tables, 1);
});

test("다른 글과 제목 또는 source_url이 다르면 중복이 아니다", () => {
  assert.equal(isDuplicateRow({ title: PAGE_TITLE, source_url: "https://example.com" }, PAGE_TITLE, SOURCE_URL), true);
  assert.equal(isDuplicateRow({ title: "다른 글", source_url: SOURCE_URL }, PAGE_TITLE, SOURCE_URL), true);
  assert.equal(
    isDuplicateRow({ title: "다른 글", source_url: OTHER_URL, content: SOURCE_URL }, PAGE_TITLE, SOURCE_URL),
    false
  );
  assert.equal(isDuplicateRow({ title: OTHER_TITLE, source_url: OTHER_URL }, PAGE_TITLE, SOURCE_URL), false);
  assert.notEqual(PAGE_TITLE, OTHER_TITLE);
  assert.notEqual(SOURCE_URL, OTHER_URL);
});

test("ZIP 바이트가 기대값과 다르면 throw한다", () => {
  const bad = new Uint8Array(ZIP_FILES[0].bytes);
  bad[0] = 0x50;
  bad[1] = 0x4b;
  bad[2] = 0x03;
  bad[3] = 0x04;
  assert.throws(() => verifyVaigentAntiAiZip("humanize-korean.zip", bad), /무결성/);
  assert.throws(() => verifyVaigentAntiAiZip("humanize-korean.zip", new Uint8Array([0x50, 0x4b, 0x03, 0x04])), /무결성/);
  assert.throws(() => verifyVaigentAntiAiZip("not-a-skill.zip", bad), /무결성/);
  const notZip = new Uint8Array(ZIP_FILES[1].bytes);
  notZip.fill(1);
  assert.throws(() => verifyVaigentAntiAiZip("anti-ai-writing.zip", notZip), /무결성/);
});
