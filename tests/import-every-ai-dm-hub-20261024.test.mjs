// every._ai DM 목록 이관 헬퍼를 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  moneyMapArticleHtml,
  postsFromDmHub,
} from "../scripts/import-every-ai-dm-hub-20261024.mjs";
import {
  parseEveryAiHtml,
  stripTracking,
} from "../scripts/import-every-ai-index-20261013.mjs";

const TRACKING = ["fb", "clid"].join("");
const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-every-ai-dm-hub-20261024.mjs"
);

const HUB_HTML = `<!doctype html><body>
  <a class="it" href="/posts/alpha?from=dm-hub"><span class="t">알파 가이드</span><span class="go">→</span></a>
  <a class="it" href="/posts/alpha?from=dm-hub"><span class="t">알파 가이드</span><span class="go">→</span></a>
  <a class="it" href="/money-map?from=dm-hub"><span class="t">AI 수익화 자료집 · AI라는 막차</span><span class="go">→</span></a>
  <a href="/kakao?from=dm-hub">카카오</a>
</body>`;

const MONEY_HTML = `<!doctype html><body><div class="ea">
  <h1>AI 수익화 자료집</h1>
  <p>AI 수익화 챌린지를 준비했습니다</p>
  <img src="/money-map/img/proof.jpg" alt="입금 화면">
  <a class="dl" href="/downloads/ai-money-map.pdf">자료집</a>
  <a class="dl" href="/downloads/ai-shorts-factory-lite.zip">쇼츠</a>
  <section class="apply"><form><input name="email"></form>
    <a href="/downloads/ai-money-map.pdf">중복 PDF</a>
    <a href="/kakao?from=dm-hub">카카오</a>
  </section>
  <div class="foot">바닥</div>
</div></body>`;

const ARTICLE_HTML = `<!doctype html><body>
  <article class="post">
    <h1>유튜브 가이드</h1>
    <p><a href="https://www.youtube.com/creators/?from=dm-hub">YouTube Creators 공식</a></p>
    <a class="kakao-post-cta" href="/kakao?from=dm-hub">카카오</a>
    <h2>함께 보면 좋은 글</h2>
    <ul><li><a href="/posts/other?from=dm-hub">다른 글</a></li></ul>
    <p>본문만 남긴다</p>
  </article>
</body>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// every._ai DM 목록에서 아직 없는 글만 Pages에 저장한다."
  );
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes(".from(\"custom_pages\").update"), false);
  assert.equal(/UPDATE\s+custom_pages/i.test(source), false);
  assert.equal(source.includes(TRACKING), false);
});

test("DM 목록은 글과 자료집만 읽고 쿼리를 뺀다", () => {
  const posts = postsFromDmHub(HUB_HTML);
  assert.deepEqual(
    posts.map((post) => post.slug),
    ["alpha", "money-map"]
  );
  assert.equal(posts[0].title, "알파 가이드");
  assert.equal(
    posts[0].sourceUrl,
    "https://every-ai-guides.vercel.app/posts/alpha"
  );
  assert.equal(posts[1].title, "AI 수익화 자료집 · AI라는 막차");
  assert.equal(
    posts[1].sourceUrl,
    "https://every-ai-guides.vercel.app/money-map"
  );
});

test("유입 파라미터를 주소에서 뺀다", () => {
  assert.equal(
    stripTracking("https://every-ai-guides.vercel.app/dm?from=littly&gclid=1"),
    "https://every-ai-guides.vercel.app/dm"
  );
  assert.equal(
    stripTracking("https://every-ai-guides.vercel.app/posts/a?from=dm-hub"),
    "https://every-ai-guides.vercel.app/posts/a"
  );
  assert.equal(
    stripTracking("https://every-ai-guides.vercel.app/posts/a?from=money-map"),
    "https://every-ai-guides.vercel.app/posts/a"
  );
  assert.equal(
    stripTracking("https://every-ai-guides.vercel.app/posts/a?from=guide-top"),
    "https://every-ai-guides.vercel.app/posts/a"
  );
});

test("자료집 랜딩은 신청 폼과 카카오를 빼고 본문만 남긴다", () => {
  const html = moneyMapArticleHtml(MONEY_HTML);
  assert.equal(html.includes("<article class=\"post\">"), true);
  assert.equal(html.includes("AI 수익화 자료집"), true);
  assert.equal(html.includes("AI 수익화 챌린지를 준비했습니다"), true);
  assert.equal(html.includes("/money-map/img/proof.jpg"), true);
  assert.equal(html.includes("/downloads/ai-money-map.pdf"), true);
  assert.equal(html.includes("/downloads/ai-shorts-factory-lite.zip"), true);
  assert.equal(html.split("/downloads/ai-money-map.pdf").length - 1, 1);
  assert.equal(html.includes("kakao"), false);
  assert.equal(html.includes("<form"), false);
  assert.equal(html.includes("class=\"apply\""), false);
  assert.equal(html.includes("class=\"foot\""), false);
  assert.equal(html.includes("중복 PDF"), false);
});

test("본문 유튜브 링크는 남기고 관련 글과 카카오는 뺀다", () => {
  const { markdown } = parseEveryAiHtml(
    ARTICLE_HTML,
    "https://every-ai-guides.vercel.app/posts/claude-youtube-prompts-8"
  );
  assert.equal(markdown.includes("https://www.youtube.com/creators/"), true);
  assert.equal(markdown.includes("함께 보면 좋은 글"), false);
  assert.equal(markdown.includes("/posts/other"), false);
  assert.equal(markdown.includes("kakao"), false);
  assert.equal(markdown.includes("from=dm-hub"), false);
  assert.equal(markdown.includes("from=dm"), false);
});
