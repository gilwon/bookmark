// every._ai DM 목록에서 아직 없는 글만 Pages에 저장한다.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import { documentStats } from "./import-claude-eli5-page.mjs";
import {
  SITE_ORIGIN,
  assertImported,
  buildImportedPage,
  loadProductionRows,
  persist,
  sourceMarkers,
} from "./import-every-ai-index-20261013.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const HUB_URL = `${SITE_ORIGIN}/dm`;
const MONEY_MAP_URL = `${SITE_ORIGIN}/money-map`;

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

/** DM 허브에서 글 주소와 목록 제목만 읽는다. */
export function postsFromDmHub(html) {
  const $ = cheerio.load(html);
  const posts = [];
  const seen = new Set();
  $("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href") || "";
    const path = href.split("#")[0].split("?")[0].replace(/\/$/, "");
    const isPost = path.startsWith("/posts/") && path.length > "/posts/".length;
    if (!isPost && path !== "/money-map") return;
    if (seen.has(path)) return;
    seen.add(path);
    const title = $(anchor)
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/→$/, "")
      .trim();
    if (!title) throw new Error(`목록 제목이 없습니다. ${path}`);
    posts.push({
      slug: path === "/money-map" ? "money-map" : path.slice("/posts/".length),
      title,
      sourceUrl: `${SITE_ORIGIN}${path}`,
    });
  });
  if (!posts.length) throw new Error("DM 목록에서 글을 찾지 못했습니다.");
  return posts;
}

/** 수익화 자료집 랜딩을 가이드 본문 형태로 바꾼다. 신청 폼과 카카오는 뺀다. */
export function moneyMapArticleHtml(html) {
  const $ = cheerio.load(html);
  const body = $("div.ea").first();
  if (!body.length) throw new Error("money-map 본문을 찾지 못했습니다.");
  body.find("section.apply, form, script, style, noscript, .foot, a[href*='kakao'], button").remove();
  const title = body.find("h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) throw new Error("money-map 제목을 찾지 못했습니다.");
  return `<!doctype html><html><body><article class="post">${body.html()}</article></body></html>`;
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return { markdownToTiptapDoc, preparePageFindability, isMissingPageFindabilityColumn };
}

function loadLocalRows() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  try {
    return db
      .prepare("SELECT id, title, source_url FROM custom_pages WHERE user_id = ?")
      .all(LOCAL_USER);
  } finally {
    db.close();
  }
}

function rowHit(rows, title, markers) {
  return (
    (rows ?? []).find(
      (row) => row.title === title || markers.includes(row.source_url)
    ) ?? null
  );
}

function existingBoth(localRows, prodRows, title, markers, sourceUrl) {
  const local = rowHit(localRows, title, markers);
  const prod = rowHit(prodRows, title, markers);
  if ((local && !prod) || (!local && prod)) {
    throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${sourceUrl}`);
  }
  return local && prod ? local : null;
}

function emit(payload) {
  const text = JSON.stringify(payload);
  if (text.includes("data:")) throw new Error("출력에 data URL이 있습니다.");
  console.log(text);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.text();
}

function hashOf(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const libs = loadLibs();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const posts = postsFromDmHub(await fetchText(HUB_URL));
  const localRows = loadLocalRows();
  const prodRows = await loadProductionRows(supabase);
  const pages = [];
  let skipCount = 0;
  let insertCount = 0;
  for (const post of posts) {
    const markers = sourceMarkers(post.sourceUrl);
    const known = existingBoth(localRows, prodRows, post.title, markers, post.sourceUrl);
    if (known) {
      skipCount += 1;
      pages.push({
        slug: post.slug,
        title: known.title,
        pageId: known.id,
        action: "skip",
        fetched: false,
      });
      continue;
    }
    await pause(300);
    const options =
      post.sourceUrl === MONEY_MAP_URL ? { allowSnippets: ["AI 수익화 챌린지"] } : {};
    const htmlOverride =
      post.sourceUrl === MONEY_MAP_URL
        ? moneyMapArticleHtml(await fetchText(MONEY_MAP_URL))
        : "";
    const built = await buildImportedPage(post.sourceUrl, htmlOverride, options);
    const again = existingBoth(
      localRows,
      prodRows,
      built.title,
      markers,
      post.sourceUrl
    );
    if (again) {
      skipCount += 1;
      pages.push({
        slug: post.slug,
        title: again.title,
        pageId: again.id,
        action: "skip",
        fetched: true,
      });
      continue;
    }
    const content = JSON.stringify(libs.markdownToTiptapDoc(built.markdown));
    const stats = documentStats(content);
    assertImported({
      title: built.title,
      markdown: built.markdown,
      stats,
      content,
      plan: built.plan,
      sourceUrl: post.sourceUrl,
      allowSnippets: built.allowSnippets,
    });
    if (stats.tables !== built.plan.tables) {
      throw new Error(`표 수가 다릅니다. ${post.slug} ${stats.tables}`);
    }
    if (stats.codes !== built.plan.codes) {
      throw new Error(`코드 블록 수가 다릅니다. ${post.slug} ${stats.codes}`);
    }
    if (checkOnly) {
      pages.push({
        slug: post.slug,
        title: built.title,
        action: "check",
        images: stats.images,
        attachments: stats.attachments,
        tables: stats.tables,
        codes: stats.codes,
        links: stats.links,
        length: content.length,
        hash: hashOf(content),
      });
      continue;
    }
    const saved = await persist(
      { title: built.title, content, sourceUrl: post.sourceUrl },
      libs,
      null
    );
    const action = saved.localPages + saved.prodPages > 0 ? "insert" : "skip";
    if (action === "insert") insertCount += 1;
    else skipCount += 1;
    const stored = {
      id: saved.pageId,
      title: built.title,
      source_url: post.sourceUrl,
    };
    if (saved.localPages) localRows.push(stored);
    if (saved.prodPages) prodRows.push(stored);
    pages.push({
      slug: post.slug,
      title: built.title,
      pageId: saved.pageId,
      action,
      images: stats.images,
      attachments: stats.attachments,
      tables: stats.tables,
      codes: stats.codes,
      links: stats.links,
      length: content.length,
      hash: hashOf(content),
      createdAt: saved.createdAt,
      localPages: saved.localPages,
      prodPages: saved.prodPages,
    });
  }
  emit({
    hubCount: posts.length,
    skipCount,
    insertCount,
    pages,
  });
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
