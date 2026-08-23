// 네이버 코닥 필름 프롬프트 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SOURCE_URL,
  SKIP_IMAGE_RE,
  originalNaverImageUrl,
  isSkipImage,
  wrapKodakPrompt,
  cleanArticleMarkdown,
} from "../scripts/import-naver-kodak-film-prompt-page.mjs";

const KODAK_PROMPT =
  "Edit the uploaded photo while preserving the original image exactly. Keep the same person, face, hairstyle, expression, pose, outfit, hands, objects, background, location, scenery, composition, framing, perspective, camera angle, and lighting unchanged. Do not add, remove, move, replace, or redesign anything. Apply a STRONG and clearly visible Kodak 35mm film look to the exact same photo. Make the Kodak mood obvious at first glance while keeping the image photorealistic. Use: - warm golden-amber highlights - rich warm skin tones - slightly deeper shadows - gently faded but rich colors - subtle yellow-orange warmth - nostalgic contrast - visible fine 35mm film grain - soft analog texture - gentle highlight halation - slight softness instead of digital sharpness - noticeable red-orange film burn / light leak along the outer edge - subtle vintage scan feel The film effect should feel stronger and more atmospheric than a basic color filter, like a real Kodak film photo scan. Important: the result must still look like the EXACT SAME PHOTO, not a new scene. Do not change the background, subject, pose, outfit, people, objects, location, or mood. Think: same photo, same moment, same composition, same location, same person — only transformed into a strong Kodak film after image with clear analog warmth, grain, halation, and light leaks. No scene regeneration, no background replacement, no facial changes, no text, no watermark, no logo. Make the Kodak film treatment bold and unmistakable, with clearly visible analog warmth, grain, halation, and edge light leaks, while still preserving the exact original photo.";

const POSTFILES_W773 =
  "https://postfiles.pstatic.net/MjAyNjA4MjNfMTQy/MDAxNzg3NDYwMjk0NTEz.0WuvbWtXMuBTVYpBLzzz82nGXkotBGAm_YPrACOy7e0g.yzTTfDX9So8bPhVOPgjqrxBtShHR_35T-Kg6wqV9-PIg.PNG/_%EC%BD%94%EB%8B%A5%ED%95%84%EC%B9%B401.png?type=w773";
const MBLOGTHUMB_W80 =
  "https://mblogthumb-phinf.pstatic.net/MjAyNjA4MjNfMTQy/MDAxNzg3NDYwMjk0NTEz.0WuvbWtXMuBTVYpBLzzz82nGXkotBGAm_YPrACOy7e0g.yzTTfDX9So8bPhVOPgjqrxBtShHR_35T-Kg6wqV9-PIg.PNG/_%EC%BD%94%EB%8B%A5%ED%95%84%EC%B9%B401.png?type=w80_blur";
const MBLOGTHUMB_W800 =
  "https://mblogthumb-phinf.pstatic.net/MjAyNjA4MjNfMTQy/MDAxNzg3NDYwMjk0NTEz.0WuvbWtXMuBTVYpBLzzz82nGXkotBGAm_YPrACOy7e0g.yzTTfDX9So8bPhVOPgjqrxBtShHR_35T-Kg6wqV9-PIg.PNG/_%EC%BD%94%EB%8B%A5%ED%95%84%EC%B9%B401.png?type=w800";
const BLOGFILES_ORIGINAL =
  "https://blogfiles.pstatic.net/MjAyNjA4MjNfMTQy/MDAxNzg3NDYwMjk0NTEz.0WuvbWtXMuBTVYpBLzzz82nGXkotBGAm_YPrACOy7e0g.yzTTfDX9So8bPhVOPgjqrxBtShHR_35T-Kg6wqV9-PIg.PNG/_%EC%BD%94%EB%8B%A5%ED%95%84%EC%B9%B401.png";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/import-naver-kodak-film-prompt-page.mjs"),
    "utf8"
  );
  assert.equal(
    source.split("\n")[0],
    "// 네이버 블로그 코닥 필름 프롬프트를 Pages에만 저장한다"
  );
});

test("SOURCE_URL에 fbclid와 모바일 PostView가 없다", () => {
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("m.blog.naver.com"), false);
  assert.equal(SOURCE_URL.includes("PostView"), false);
  assert.equal(SOURCE_URL, "https://blog.naver.com/ai_newceo/224387395142");
});

test("originalNaverImageUrl은 썸네일 쿼리를 빼고 blogfiles 원본으로 바꾼다", () => {
  assert.equal(originalNaverImageUrl(POSTFILES_W773), BLOGFILES_ORIGINAL);
  assert.equal(originalNaverImageUrl(MBLOGTHUMB_W80), BLOGFILES_ORIGINAL);
  assert.equal(originalNaverImageUrl(MBLOGTHUMB_W800), BLOGFILES_ORIGINAL);
  assert.equal(
    originalNaverImageUrl(`${BLOGFILES_ORIGINAL}?type=w773`),
    BLOGFILES_ORIGINAL
  );
  assert.equal(originalNaverImageUrl(POSTFILES_W773).includes("w80_blur"), false);
  assert.equal(originalNaverImageUrl(POSTFILES_W773).includes("?"), false);
  assert.equal(originalNaverImageUrl(MBLOGTHUMB_W80).includes("mblogthumb"), false);
  assert.equal(originalNaverImageUrl(POSTFILES_W773).includes("postfiles"), false);
});

test("isSkipImage는 프로필·스티커·아이콘만 걸러 코닥 PNG는 남긴다", () => {
  assert.equal(
    isSkipImage("https://blogpfthumb-phinf.pstatic.net/MjAyNjA4MjNfMTQy/profile.png"),
    true
  );
  assert.equal(
    isSkipImage("https://storep-phinf.pstatic.net/cafe_001/original_5.gif?type=pa50_50"),
    true
  );
  assert.equal(
    isSkipImage("https://ssl.pstatic.net/static/blog/img_ani_blogid1.gif"),
    true
  );
  assert.equal(isSkipImage("https://blogimgs.pstatic.net/nblog/blog_Icon.png"), true);
  assert.equal(isSkipImage("https://example.com/image.png?type=pa100"), true);
  assert.equal(SKIP_IMAGE_RE.test("se-sticker-image"), true);
  assert.equal(isSkipImage(BLOGFILES_ORIGINAL), false);
  assert.equal(isSkipImage(POSTFILES_W773), false);
});

test("wrapKodakPrompt는 영문 문단을 펜스로 감싸고 본문은 바꾸지 않는다", () => {
  const wrapped = wrapKodakPrompt(`머리\n\n${KODAK_PROMPT}\n\n꼬리`);
  const fences = [...wrapped.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)].map(
    (match) => match[1]
  );
  assert.equal(fences.length, 1);
  assert.equal(fences[0], `${KODAK_PROMPT}\n`);
  assert.equal(fences[0].includes(KODAK_PROMPT), true);
  assert.equal(wrapped.includes(`\`\`\`\n${KODAK_PROMPT}\n\`\`\``), true);
  const already = `\`\`\`\n${KODAK_PROMPT}\n\`\`\``;
  assert.equal(wrapKodakPrompt(already), already);
});

test("cleanArticleMarkdown은 fbclid와 proxyReferer를 지운다", () => {
  const cleaned = cleanArticleMarkdown(
    `링크 [인스타](https://www.instagram.com/ai_newpd/?fbclid=IwAR1&proxyReferer=https%3A%2F%2Fm.blog.naver.com%2FPostView.naver&trackingCode=blog)\n\nhttps://example.com/x?fbclid=abc&ok=1\n`
  );
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("proxyReferer"), false);
  assert.equal(cleaned.includes("trackingCode"), false);
  assert.equal(cleaned.includes("https://www.instagram.com/ai_newpd/"), true);
  assert.equal(cleanArticleMarkdown("**\\[사용 방법\\]**").includes("[사용 방법]"), true);
});
