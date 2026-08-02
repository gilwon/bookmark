// UI 디자인 스타일 Tistory 글과 이미지를 Pages 문서로 가져온다
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  existsSync,
  readFileSync,
} from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readability } from "@mozilla/readability";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetDirectory = resolve(root, "public/imports/ui-design-styles");
const SOURCE = "https://miny.tistory.com/30";
const PAGE_TITLE =
  "UI 디자인 스타일 20가지 총정리 (플랫, 글래스모피즘, 뉴모피즘 등)";
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const isCheck = process.argv.includes("--check");
const images = [
  ["01-ui-design-styles-cover.jpg", "UI 디자인 스타일 20가지 총정리"],
  ["02-flat-design.jpg", "플랫 디자인"],
  ["03-material-design.jpg", "머티리얼 디자인"],
  ["04-fluent-design.jpg", "플루언트 디자인"],
  ["05-apple-human-interface.jpg", "애플 휴먼 인터페이스"],
  ["06-glassmorphism.jpg", "글래스모피즘"],
  ["07-neumorphism.jpg", "뉴모피즘"],
  ["08-minimalism.jpg", "미니멀리즘"],
  ["09-dark-mode.jpg", "다크 모드"],
  ["10-card-based-design.jpg", "카드 기반 디자인"],
  ["11-gradient-design.jpg", "그라데이션 디자인"],
  ["12-typographic-design.jpg", "타이포그래픽 디자인"],
  ["13-brutalism.jpg", "브루탈리즘"],
  ["14-neobrutalism.jpg", "네오브루탈리즘"],
  ["15-3d-design.jpg", "3D 디자인"],
  ["16-isometric-design.jpg", "아이소메트릭 디자인"],
  ["17-claymorphism.jpg", "클레이모피즘"],
  ["18-aurora-ui.jpg", "오로라 UI"],
  ["19-frutiger-aero.jpg", "프루티거 에어로"],
  ["20-skeuomorphism.jpg", "스큐어모피즘"],
  ["21-ai-summary-notice.png", "AI 정리 고지"],
];

const tsx = createRequire(import.meta.url)("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = createRequire(import.meta.url)(
  resolve(root, "src/lib/markdown-to-tiptap.ts")
);

const response = await fetch(SOURCE, {
  headers: { "user-agent": "Mozilla/5.0" },
});
if (!response.ok) throw new Error(`원문 응답 오류. ${response.status}`);
const html = await response.text();
const { document } = parseHTML(html);
const originalTitle = document
  .querySelector('meta[property="og:title"]')
  ?.getAttribute("content")
  ?.trim();
const sourceArticle = document.querySelector(
  "#article-content .tt_article_useless_p_margin"
);
if (!sourceArticle) throw new Error("원문 본문 컨테이너를 찾지 못했습니다.");

const sourceImages = [...sourceArticle.querySelectorAll("img")];
const sourceLinks = [...sourceArticle.querySelectorAll("a")];
assert.equal(originalTitle, PAGE_TITLE, "원문 제목이 달라졌습니다.");
assert.equal(sourceImages.length, images.length, "원문 이미지 수가 달라졌습니다.");
assert.equal(sourceLinks.length, 48, "원문 링크 수가 달라졌습니다.");

await mkdir(assetDirectory, { recursive: true });
await Promise.all(
  sourceImages.map(async (image, index) => {
    const [filename, alt] = images[index];
    const sourceUrl = image.getAttribute("src");
    if (!sourceUrl) throw new Error(`${index + 1}번 이미지 URL이 없습니다.`);
    const assetPath = resolve(assetDirectory, filename);
    const imageResponse = await fetch(sourceUrl, {
      headers: { referer: SOURCE, "user-agent": "Mozilla/5.0" },
    });
    if (!imageResponse.ok) {
      throw new Error(`${filename} 다운로드 오류. ${imageResponse.status}`);
    }
    assert.match(
      imageResponse.headers.get("content-type") ?? "",
      /^image\//,
      `${filename} 응답이 이미지가 아닙니다.`
    );
    const downloaded = Buffer.from(await imageResponse.arrayBuffer());
    if (existsSync(assetPath)) {
      assert.deepEqual(
        await readFile(assetPath),
        downloaded,
        `${filename}이 원문 이미지와 다릅니다.`
      );
    } else {
      await writeFile(assetPath, downloaded);
    }
    image.setAttribute("src", `/imports/ui-design-styles/${filename}`);
    image.setAttribute("alt", alt);
  })
);

const originalHrefs = sourceLinks.map((link) => {
  const href = new URL(link.getAttribute("href"), SOURCE).href;
  link.setAttribute("href", href);
  return href;
});
const { document: isolatedDocument } = parseHTML(
  `<html><head><title>${PAGE_TITLE}</title></head><body><article>${sourceArticle.innerHTML}</article></body></html>`
);
const readable = new Readability(isolatedDocument).parse();
if (!readable) throw new Error("Readability 본문 추출에 실패했습니다.");

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
turndown.addRule("tables", {
  filter: "table",
  replacement(_content, table) {
    const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th,td")).map((cell) =>
        turndown
          .turndown(cell.innerHTML)
          .replace(/\n+/g, " ")
          .replace(/\|/g, "\\|")
          .trim()
      )
    );
    if (!rows.length) return "";
    const divider = rows[0].map(() => "---");
    return `\n\n${[rows[0], divider, ...rows.slice(1)]
      .map((row) => `| ${row.join(" | ")} |`)
      .join("\n")}\n\n`;
  },
});

const markdown = turndown.turndown(readable.content).trim();
const doc = markdownToTiptapDoc(markdown);
const tiptapImages = [];
const tiptapLinks = [];
const tiptapTables = [];
function collect(node) {
  if (node.type === "image") tiptapImages.push(node.attrs?.src);
  if (node.type === "table") tiptapTables.push(node);
  for (const mark of node.marks ?? []) {
    if (mark.type === "link") tiptapLinks.push(mark.attrs?.href);
  }
  for (const child of node.content ?? []) collect(child);
}
collect(doc);

const localFiles = (await readdir(assetDirectory))
  .filter((filename) => /\.(?:jpe?g|png)$/i.test(filename))
  .sort();
const expectedFiles = images.map(([filename]) => filename).sort();
assert.deepEqual(localFiles, expectedFiles, "로컬 이미지 파일 구성이 다릅니다.");
for (const filename of localFiles) {
  assert.ok((await stat(resolve(assetDirectory, filename))).size > 0, `${filename}이 비어 있습니다.`);
}
assert.equal(tiptapImages.length, 21, "TipTap 이미지 수가 다릅니다.");
assert.deepEqual(
  tiptapImages,
  images.map(([filename]) => `/imports/ui-design-styles/${filename}`),
  "TipTap 이미지 경로나 순서가 다릅니다."
);
assert.equal(tiptapTables.length, sourceArticle.querySelectorAll("table").length, "표가 모두 보존되지 않았습니다.");
assert.deepEqual(tiptapLinks, originalHrefs, "원문 링크나 순서가 모두 보존되지 않았습니다.");

if (isCheck) {
  console.log(
    JSON.stringify(
      {
        title: originalTitle,
        sourceImages: sourceImages.length,
        sourceLinks: sourceLinks.length,
        localAssets: localFiles.length,
        tiptapImages: tiptapImages.length,
        tiptapLinks: tiptapLinks.length,
        tables: tiptapTables.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^("|')|("|')$/g, "");
  }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase 운영 환경변수가 없습니다.");
}

const content = JSON.stringify(doc);
const now = new Date().toISOString();
const db = new Database(resolve(root, "data/mymark.db"));
let localPageId;
let localResult;
try {
  const existing = db
    .prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND title = ? LIMIT 1")
    .get(LOCAL_USER, PAGE_TITLE);
  localPageId = existing?.id ?? randomUUID();
  if (!existing) {
    db.prepare(
      "INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(localPageId, LOCAL_USER, PAGE_TITLE, content, now, now);
    localResult = "inserted";
  } else if (existing.content !== content) {
    db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(content, now, existing.id, LOCAL_USER);
    localResult = "updated";
  } else {
    localResult = "unchanged";
  }
} finally {
  db.close();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const { data: existingPages, error: lookupError } = await supabase
  .from("custom_pages")
  .select("id, content")
  .eq("user_id", PROD_USER)
  .eq("title", PAGE_TITLE)
  .limit(1);
if (lookupError) throw lookupError;
const existingPage = existingPages?.[0];
const prodPageId = existingPage?.id ?? randomUUID();
let prodResult;
if (!existingPage) {
  const { error } = await supabase.from("custom_pages").insert({
    id: prodPageId,
    user_id: PROD_USER,
    title: PAGE_TITLE,
    content,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  prodResult = "inserted";
} else if (existingPage.content !== content) {
  const { error } = await supabase
    .from("custom_pages")
    .update({ content, updated_at: now })
    .eq("id", existingPage.id)
    .eq("user_id", PROD_USER);
  if (error) throw error;
  prodResult = "updated";
} else {
  prodResult = "unchanged";
}

console.log(JSON.stringify({ local: localResult, localPageId, supabase: prodResult, prodPageId }, null, 2));
