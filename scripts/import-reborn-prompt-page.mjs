// REBORN 프롬프트 정리기 랜딩을 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const INSTALL_COMMANDS = [
  "reborn-prompt 설치해줘",
  "!npx reborn-prompt",
  "npx reborn-prompt",
];
const AFTER_PROMPT = `[할 일]
결제 폼 제출이 되게 고친다

[산출물]
코드 변경만 — 설명 없이

[손댈 범위]
CheckoutForm.tsx, validate.ts
손대지 말 것: 그 외 전부

[끝나는 조건]
카드가 실제로 결제되고 테스트 통과`;
const FORBIDDEN = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "funnel-utm",
  "fbclid",
];

export const SOURCE_URL = "https://rebornlabs.kr/prompt";
export const PAGE_TITLE = "프롬프트 정리기 — 한 문장을 그대로 쓸 수 있는 프롬프트로";
export const REQUIRED_PHRASES = [
  "네 칸을 대신 채웁니다",
  "CheckoutForm.tsx",
  ".claude/decisions.md",
  "npx reborn-prompt",
  "reborn-prompt 설치해줘",
  "https://rebornlabs.kr/reborn-prompt.zip",
  "https://rebornlabs.kr/claudekit",
];

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const k = match[1].trim();
    let v = match[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

/** 유입 추적 쿼리를 빼고 상대 경로를 절대 주소로 바꾼다. */
export function stripTrackingUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url, SOURCE_URL);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "fbclid") {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url
      .replace(/[?&](?:utm_[^=&#]*|fbclid)=[^&\s)#]*/g, "")
      .replace(/[?&]$/, "");
  }
}

/** Turndown 이스케이프와 상대 경로·UTM을 저장용 마크다운에서 걷어낸다. */
export function cleanArticleMarkdown(markdown) {
  return markdown
    .replace(/\\([\[\]])/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTrackingUrl(path)})`)
    .replace(/https?:\/\/[^\s)]+/g, stripTrackingUrl)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPageMarkdown(articleMarkdown) {
  return [`# ${PAGE_TITLE}`, `> 원문. [REBORN LABS](${SOURCE_URL})`, articleMarkdown].join(
    "\n\n"
  );
}

function loadMarkdownToTiptap() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  return markdownToTiptapDoc;
}

function fenceInstallCommands($, rootEl) {
  rootEl.find("code").each((_, el) => {
    const node = $(el);
    if (node.closest("pre").length) return;
    const text = node.text().trim();
    if (!INSTALL_COMMANDS.includes(text)) return;
    node.replaceWith($("<pre>").append($("<code>").text(text)));
  });
}

function assertIntegrity(markdown, content) {
  if (!markdown.includes(`# ${PAGE_TITLE}`) || !content.includes(PAGE_TITLE)) {
    throw new Error("페이지 제목이 없습니다.");
  }
  if (!markdown.includes(SOURCE_URL) || !content.includes(SOURCE_URL)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  const fences = [...markdown.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)].map((match) =>
    match[1]
  );
  if (!fences.some((body) => body.includes(AFTER_PROMPT))) {
    throw new Error("AFTER 본문이 코드 펜스 안에 없습니다.");
  }
  for (const forbidden of FORBIDDEN) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
}

async function buildImportedPage() {
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  const content = $("body").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
  content.find("script, style, button.cpy").remove();
  content.find(".cell b").after("<br>");
  content.find(".badge + .badge").before(" ");
  fenceInstallCommands($, content);
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", stripTrackingUrl(href));
  });

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  // pre 원문을 이스케이프 없이 코드 펜스로 옮긴다.
  turndown.addRule("preToFence", {
    filter: "pre",
    replacement(_inner, node) {
      const text = String(node.textContent || "").replace(/\n$/, "");
      return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    },
  });
  const articleMarkdown = cleanArticleMarkdown(
    turndown.turndown(content.html() || "").trim()
  );
  const markdown = buildPageMarkdown(articleMarkdown);
  const pageContent = JSON.stringify(loadMarkdownToTiptap()(markdown));
  assertIntegrity(markdown, pageContent);
  return { markdown, content: pageContent };
}

function pageAction(result) {
  if (result.pages) return "insert";
  if (result.pageUpdates) return "update";
  return "skip";
}

function findLocalPage(db, title) {
  const byTitle = db
    .prepare(
      "SELECT id, title, content FROM custom_pages WHERE user_id = ? AND title = ?"
    )
    .get(LOCAL_USER, title);
  if (byTitle) return { row: byTitle, byTitle: true };
  const bySource = db
    .prepare(
      `SELECT id, title, content FROM custom_pages
       WHERE user_id = ? AND content LIKE ?
       LIMIT 1`
    )
    .get(LOCAL_USER, `%${SOURCE_URL}%`);
  if (bySource) return { row: bySource, byTitle: false };
  return { row: null, byTitle: false };
}

function importLocal(page) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const found = findLocalPage(db, page.title);
  if (found.row && found.byTitle && found.row.content === page.content) {
    result.pageSkips += 1;
    result.pageId = found.row.id;
  } else if (found.row && found.byTitle) {
    db.prepare(
      "UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
    ).run(page.content, page.updated_at, found.row.id, LOCAL_USER);
    result.pageUpdates += 1;
    result.pageId = found.row.id;
  } else if (found.row) {
    // 제목이 다른 원문 중복은 덮어쓰지 않는다.
    result.pageSkips += 1;
    result.pageId = found.row.id;
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      page.created_at,
      page.updated_at
    );
    result.pages += 1;
  }
  db.close();
  return result;
}

async function findProductionPage(supabase, title) {
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title, content")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return { row: data[0], byTitle: true };

  // 본문 전체는 받지 않고 원문 주소만 있는 행을 찾는다.
  const { data: bySource, error: sourceError } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .like("content", `%${SOURCE_URL}%`)
    .limit(1);
  if (sourceError) throw sourceError;
  if (bySource?.[0]) return { row: { ...bySource[0], content: "" }, byTitle: false };
  return { row: null, byTitle: false };
}

async function importProduction(page) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const found = await findProductionPage(supabase, page.title);
  if (found.row && found.byTitle && found.row.content === page.content) {
    result.pageSkips += 1;
    result.pageId = found.row.id;
    return result;
  }
  if (found.row && found.byTitle) {
    const { error: updateError } = await supabase
      .from("custom_pages")
      .update({ content: page.content, updated_at: page.updated_at })
      .eq("id", found.row.id)
      .eq("user_id", PROD_USER);
    if (updateError) throw updateError;
    result.pageUpdates += 1;
    result.pageId = found.row.id;
    return result;
  }
  if (found.row) {
    result.pageSkips += 1;
    result.pageId = found.row.id;
    return result;
  }
  const { error: insertError } = await supabase.from("custom_pages").insert({
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    created_at: page.created_at,
    updated_at: page.updated_at,
  });
  if (insertError) throw insertError;
  result.pages += 1;
  return result;
}

async function main() {
  const imported = await buildImportedPage();
  if (process.argv.includes("--check")) {
    console.log(
      JSON.stringify(
        {
          pageTitle: PAGE_TITLE,
          markdownLength: imported.markdown.length,
        },
        null,
        2
      )
    );
    return;
  }

  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: PAGE_TITLE,
    content: imported.content,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record);
  record.id = local.pageId;
  const production = await importProduction(record);
  const pageId = production.pageId || local.pageId;
  console.log(
    JSON.stringify(
      {
        local: {
          action: pageAction(local),
          pages: local.pages,
          pageUpdates: local.pageUpdates,
          pageSkips: local.pageSkips,
        },
        production: {
          action: pageAction(production),
          pages: production.pages,
          pageUpdates: production.pageUpdates,
          pageSkips: production.pageSkips,
        },
        pageId,
        path: `/pages/${pageId}`,
        pageTitle: PAGE_TITLE,
      },
      null,
      2
    )
  );
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
