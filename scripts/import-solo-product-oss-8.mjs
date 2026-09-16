// 혼자 프로덕트용 오픈소스 8개를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

export const PAGE_TITLE = "혼자 프로덕트 만들 때 묶어 둘 오픈소스 8개";
export const EXPECTED_IMAGES = 0;
export const EXPECTED_ATTACHMENTS = 0;

export const REPOS = [
  { name: "Remotion", href: "https://github.com/remotion-dev/remotion" },
  { name: "Recordly", href: "https://github.com/webadderallorg/recordly" },
  { name: "Dify", href: "https://github.com/langgenius/dify" },
  { name: "gstack", href: "https://github.com/garrytan/gstack" },
  { name: "shadcn/ui", href: "https://github.com/shadcn-ui/ui" },
  { name: "Supabase", href: "https://github.com/supabase/supabase" },
  {
    name: "Marketing Skills",
    href: "https://github.com/coreyhaines31/marketingskills",
  },
  { name: "Postiz", href: "https://github.com/gitroomhq/postiz-app" },
];

export const PAGE_MARKDOWN = `# ${PAGE_TITLE}

요즘은 프로덕트 하나 만들려고 SaaS를 10개씩 결제할 필요가 없을지도 모릅니다.

개발은 AI 팀에게 맡기고, UI는 검증된 컴포넌트로 만들고, DB와 인증을 붙이고, 완성되면 데모 영상을 찍고, 마케팅 문구를 만들고, SNS 예약까지 걸어둡니다.

찾아보니 이 과정 거의 전체를 오픈소스로 연결할 수 있습니다.

Build → Backend → UI → Video → Marketing → Distribution

혼자 프로덕트 만드는 사람이라면 이 8개는 묶어서 저장해둘 만합니다.

## 1. Remotion

제품을 다 만들었는데 출시 영상 때문에 다시 영상편집기를 배운다?

Remotion은 영상을 React 코드로 만듭니다.

텍스트, 이미지, 애니메이션, 제품 화면을 Component처럼 조립하고 최종 결과를 MP4로 Render합니다.

Coding Agent와 특히 궁합이 좋습니다.

공식 Agent Skill도 있어서

> 우리 앱 화면으로 20초짜리 Launch Video 만들어줘.

같은 Workflow까지 가져갈 수 있습니다.

[${REPOS[0].href}](${REPOS[0].href})

## 2. Recordly

Remotion이 코드로 영상을 만든다면 Recordly는 실제 제품을 보여주는 쪽입니다.

화면을 녹화하고, Cursor를 따라가고, 필요한 곳을 Zoom-in해서 제품 Demo 영상을 빠르게 만듭니다.

바이브코딩으로 앱 하나 만들고

> 이거 실제로 어떻게 돌아가는지 30초만 보여주고 싶다.

할 때 써먹기 좋은 종류입니다.

[${REPOS[1].href}](${REPOS[1].href})

## 3. Dify

AI 기능이 제품의 핵심이라면 여기서부터 판이 커집니다.

Chatbot 하나 만드는 도구가 아니라 Agent, Workflow, RAG, Knowledge Base, Model, Tool, API를 화면에서 조립해서 AI Backend를 만들 수 있습니다.

OpenAI 하나에 묶일 필요도 없습니다.

여러 모델과 Tool을 연결해서 실제 서비스용 AI Workflow를 구성합니다.

[${REPOS[2].href}](${REPOS[2].href})

## 4. gstack

혼자 개발하는데 AI에게 개발자 역할 하나만 줄 필요가 있을까요?

YC의 Garry Tan이 만든 gstack은 Claude Code를 작은 개발팀처럼 사용합니다.

CEO, Engineering Manager, Designer, Developer, Reviewer 같은 역할을 나누고 기획부터 구현과 검토까지 각기 다른 관점으로 프로젝트를 밀어붙입니다.

"AI에게 코딩 맡기기"보다 "AI 개발팀 운영하기"에 더 가깝습니다.

[${REPOS[3].href}](${REPOS[3].href})

## 5. shadcn/ui

바이브코딩 UI가 자꾸 둥근 Card, 보라색 Gradient, 똑같은 Dashboard로 나온다면 디자인을 전부 AI에게 맡기지 않는 방법도 있습니다.

shadcn/ui는 Button, Dialog, Form, Table 같은 Component를 내 프로젝트 코드로 가져와 직접 수정하면서 사용하는 방식입니다.

Library를 설치해서 종속되는 느낌보다 좋은 UI 코드를 가져와 내 것으로 만드는 쪽입니다.

[${REPOS[4].href}](${REPOS[4].href})

## 6. Supabase

원문의 링크는 잘못돼 있었습니다.

정확한 주소는 여기입니다.

[${REPOS[5].href}](${REPOS[5].href})

프로덕트를 만들다 보면 화면 다음부터 일이 커집니다.

Database, Login, File Storage, Realtime, Edge Functions, Vector. 이걸 하나씩 붙여야 합니다.

Supabase는 Postgres를 중심으로 이 Backend 영역을 한꺼번에 가져가는 선택지입니다.

특히 바이브코딩 프로젝트에서 Frontend 다음 단계로 자주 등장하는 이유가 있습니다.

## 7. Marketing Skills

제품은 만들었는데 아무도 안 들어옵니다.

여기서 개발 Skill이 아니라 마케팅 Skill을 Agent에게 넣습니다.

SEO, Copywriting, CRO, Analytics, Content Strategy, Landing Page 같은 마케팅 업무를 AI Agent가 수행할 때 참고할 방법론을 Skill로 만들어놨습니다.

코딩이 끝났다고 프로덕트가 끝나는 게 아니라는 걸 제일 잘 보여주는 저장소 중 하나입니다.

[${REPOS[6].href}](${REPOS[6].href})

## 8. Postiz

마지막은 배포가 아니라 사람들에게 알리는 일입니다.

글 하나 만들고 X, Instagram, LinkedIn, YouTube, TikTok 등 각 SNS에 들어가서 다시 올리는 작업을 줄여줍니다.

Postiz는 여러 Social 채널의 게시와 예약을 한곳에서 관리하는 오픈소스 Social Media 도구입니다.

AI 콘텐츠 기능도 붙어 있습니다.

[${REPOS[7].href}](${REPOS[7].href})

## 이 8개가 이어지는 흐름

이 8개를 연결해서 보면 도구 목록이 아니라 Workflow가 됩니다.

[${REPOS[3].name}](${REPOS[3].href})으로 기획하고 개발합니다.

[${REPOS[4].name}](${REPOS[4].href})로 화면을 만들고 [${REPOS[5].name}](${REPOS[5].href})로 Backend를 붙입니다.

AI 기능이 필요하면 [${REPOS[2].name}](${REPOS[2].href}).

출시할 때 [${REPOS[1].name}](${REPOS[1].href})로 실제 화면을 찍거나 [${REPOS[0].name}](${REPOS[0].href})으로 Launch Video를 만듭니다.

[${REPOS[6].name}](${REPOS[6].href})로 카피와 SEO를 다듬고, [${REPOS[7].name}](${REPOS[7].href})에서 SNS 배포까지 예약합니다.

예전에는 1인 개발자가 코드까지 만들면 대단했습니다.

지금은 AI 때문에 개발 속도가 빨라지면서 오히려 그다음이 더 중요해졌습니다.

만드는 능력보다 끝까지 출시하는 능력.

이 8개는 그 전체 과정에 각각 하나씩 자리를 차지합니다.
`;

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
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return {
    markdownToTiptapDoc,
    preparePageFindability,
    isMissingPageFindabilityColumn,
  };
}

/** 제목이 이 페이지와 같으면 중복이다. */
export function isDuplicateTitle(title) {
  return String(title ?? "") === PAGE_TITLE;
}

/** 본문에서 링크 href와 target을 모은다. */
export function linkAttrsOf(tiptapJsonString) {
  const links = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    for (const mark of node.marks ?? []) {
      if (mark?.type === "link" && mark.attrs?.href) {
        links.push({
          href: String(mark.attrs.href),
          target: String(mark.attrs.target ?? ""),
          rel: String(mark.attrs.rel ?? ""),
        });
      }
    }
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return links;
}

/** 이미지 노드와 첨부 href 수를 센다. */
function documentStats(tiptapJsonString) {
  const stats = { images: 0, attachments: 0 };
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") stats.images += 1;
    for (const mark of node.marks ?? []) {
      if (mark?.type === "link" && mark.attrs?.href) {
        const href = String(mark.attrs.href);
        if (
          href.startsWith("/api/page-attachments/") ||
          (href.startsWith("data:") && !href.startsWith("data:image/"))
        ) {
          stats.attachments += 1;
        }
      }
    }
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return stats;
}

function assertRecord(markdown, content) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (markdown.includes("\uFFFC")) {
    throw new Error("트레드 이미지 자리표시가 남아 있습니다.");
  }
  const links = linkAttrsOf(content);
  for (const repo of REPOS) {
    if (!markdown.includes(repo.href)) {
      throw new Error(`마크다운에 저장소 주소가 없습니다. ${repo.href}`);
    }
    const hits = links.filter((link) => link.href === repo.href);
    if (hits.length === 0) {
      throw new Error(`TipTap 링크가 없습니다. ${repo.href}`);
    }
    for (const hit of hits) {
      if (hit.target !== "_blank") {
        throw new Error(`링크가 새 창이 아닙니다. ${repo.href}`);
      }
      if (!hit.rel.includes("noopener")) {
        throw new Error(`링크 rel이 없습니다. ${repo.href}`);
      }
    }
  }
  const stats = documentStats(content);
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`이미지 수가 ${EXPECTED_IMAGES}가 아닙니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(
      `첨부 수가 ${EXPECTED_ATTACHMENTS}가 아닙니다. ${stats.attachments}`
    );
  }
}

function sqliteHasFindability(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((c) => c.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((n) =>
    cols.includes(n)
  );
}

function findLocalPage(db, title) {
  return db
    .prepare(
      `SELECT id, title FROM custom_pages WHERE user_id = ? AND title = ?`
    )
    .get(LOCAL_USER, title);
}

function importLocal(page, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    db.close();
    return result;
  }
  const found = libs.preparePageFindability({
    title: page.title,
    content: page.content,
  });
  if (sqliteHasFindability(db)) {
    db.prepare(
      `INSERT INTO custom_pages (
         id, user_id, title, content, tags, source_url, search_text, is_favorite, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      JSON.stringify(found.tags ?? []),
      found.sourceUrl || "",
      found.searchText ?? "",
      page.created_at,
      page.updated_at
    );
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
  }
  result.pages += 1;
  db.close();
  return result;
}

async function importProduction(page, libs) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", page.title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) {
    result.pageSkips += 1;
    result.pageId = data[0].id;
    return result;
  }
  const found = libs.preparePageFindability({
    title: page.title,
    content: page.content,
  });
  const full = {
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    tags: JSON.stringify(found.tags ?? []),
    source_url: found.sourceUrl || "",
    search_text: found.searchText ?? "",
    is_favorite: 0,
    created_at: page.created_at,
    updated_at: page.updated_at,
  };
  const { error: insertError } = await supabase.from("custom_pages").insert(full);
  if (insertError) {
    const missing =
      libs.isMissingPageFindabilityColumn(insertError.message) ||
      /(tags|source_url|search_text|is_favorite)/i.test(insertError.message);
    if (!missing) throw insertError;
    const { error: retryError } = await supabase.from("custom_pages").insert({
      id: page.id,
      user_id: PROD_USER,
      title: page.title,
      content: page.content,
      created_at: page.created_at,
      updated_at: page.updated_at,
    });
    if (retryError) throw retryError;
  }
  result.pages += 1;
  return result;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  if (REPOS.length !== 8) {
    throw new Error(`저장소 수가 8개가 아닙니다. ${REPOS.length}`);
  }
  const libs = loadLibs();
  const content = JSON.stringify(libs.markdownToTiptapDoc(PAGE_MARKDOWN));
  assertRecord(PAGE_MARKDOWN, content);
  const stats = documentStats(content);
  const extra = {
    pageTitle: PAGE_TITLE,
    repos: REPOS.length,
    links: linkAttrsOf(content).length,
    images: stats.images,
    attachments: stats.attachments,
  };
  if (checkOnly) {
    console.log(JSON.stringify(extra, null, 2));
    return;
  }
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: PAGE_TITLE,
    content,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  const pageId = production.pageId || local.pageId;
  console.log(
    JSON.stringify(
      {
        ...extra,
        pageId,
        path: `/pages/${pageId}`,
        local: { pages: local.pages, pageSkips: local.pageSkips },
        production: {
          pages: production.pages,
          pageSkips: production.pageSkips,
        },
      },
      null,
      2
    )
  );
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
