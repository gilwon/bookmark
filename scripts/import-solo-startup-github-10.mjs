// 혼자 스타트업용 GitHub 저장소 10선을 Pages에만 저장한다
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

export const PAGE_TITLE = "혼자 스타트업 만들 때 저장할 GitHub 10개";

export const REPOS = [
  {
    name: "gstack",
    href: "https://github.com/garrytan/gstack",
  },
  {
    name: "Last 30 Days",
    href: "https://github.com/mvanhorn/last30days-skill",
  },
  {
    name: "Marketing Skills for AI Agents",
    href: "https://github.com/coreyhaines31/marketingskills",
  },
  {
    name: "Novu",
    href: "https://github.com/novuhq/novu",
  },
  {
    name: "Papermark",
    href: "https://github.com/papermark/papermark",
  },
  {
    name: "OpenReplay",
    href: "https://github.com/openreplay/openreplay",
  },
  {
    name: "shadcn/ui",
    href: "https://github.com/shadcn-ui/ui",
  },
  {
    name: "Cap",
    href: "https://github.com/CapSoftware/Cap",
  },
  {
    name: "Dify",
    href: "https://github.com/langgenius/dify",
  },
  {
    name: "Devopness",
    href: "https://github.com/devopness/devopness",
  },
];

export const PAGE_MARKDOWN = `# ${PAGE_TITLE}

혼자 스타트업을 만들고 있다면 이 GitHub 저장소 10개는 저장해 두세요. 기획 → 개발 → 마케팅 → 분석 → 배포까지, 돈 주고 SaaS부터 결제하기 전에 오픈소스로 해결할 수 있는 게 생각보다 많습니다.

## 1. gstack — Garry Tan

Y Combinator CEO Garry Tan의 AI 개발 워크플로입니다. CEO·디자인·엔지니어링·QA·릴리스·문서 등 스타트업을 만드는 여러 작업을 AI와 함께 처리합니다.

🔗 [${REPOS[0].href}](${REPOS[0].href})

## 2. Last 30 Days

제품 만들기 전에 시장부터 조사하고 싶을 때 씁니다. Reddit, X 등에서 최근 사람들이 특정 주제에 대해 무슨 이야기를 하는지 조사합니다. "사람들이 진짜 이걸 필요로 하나?"를 개발 전에 검증하는 용도로 활용하기 좋습니다.

🔗 [${REPOS[1].href}](${REPOS[1].href})

## 3. Marketing Skills for AI Agents

개발은 AI한테 시키는데 마케팅은 어떻게 해야 할지 모르겠다면 이 모음입니다. CRO, 카피라이팅, SEO, 광고, 분석, 콘텐츠 전략, 성장 전략 등 AI에게 마케팅 능력을 붙여 주는 Skill 모음입니다. Codex, Claude Code, Cursor, Windsurf 등에서 사용할 수 있습니다.

🔗 [${REPOS[2].href}](${REPOS[2].href})

## 4. Novu

서비스를 만들다 보면 결국 필요한 게 알림입니다. 이메일, SMS, Push, In-App 알림을 각각 따로 만드는 대신 하나의 시스템으로 관리할 수 있습니다.

🔗 [${REPOS[3].href}](${REPOS[3].href})

## 5. Papermark

투자자나 고객에게 자료를 보냈는데 "봤을까?"가 궁금할 때 씁니다. 누가 문서를 열었는지, 어떤 페이지를 봤는지 등을 분석할 수 있는 문서 공유·분석 플랫폼입니다.

🔗 [${REPOS[4].href}](${REPOS[4].href})

## 6. OpenReplay

내 서비스를 사람들이 실제로 어떻게 사용하는지 보고 싶을 때 씁니다. 사용자의 세션을 재생해서 어디에서 막혔는지, 어디에서 이탈했는지, 어떤 오류가 발생했는지 분석할 수 있습니다.

🔗 [${REPOS[5].href}](${REPOS[5].href})

## 7. shadcn/ui

버튼, 카드, Dialog, Form 등 잘 디자인된 UI 컴포넌트를 가져와서 내 프로젝트 코드로 직접 소유하고 수정하는 방식입니다. AI로 프론트엔드를 만들 때 많이 활용됩니다.

🔗 [${REPOS[6].href}](${REPOS[6].href})

## 8. Cap

화면을 녹화하고 제품 데모나 소개 영상을 만드는 데 활용할 수 있는 오픈소스 Loom 대안입니다.

🔗 [${REPOS[7].href}](${REPOS[7].href})

## 9. Dify

AI Agent, Workflow, RAG, LLM 앱 등을 구축하고 운영할 수 있는 오픈소스 AI 플랫폼입니다.

🔗 [${REPOS[8].href}](${REPOS[8].href})

## 10. Devopness

AWS, Azure, GCP, DigitalOcean, Hetzner 등에서 서버 구성 → 인프라 → CI/CD → 배포를 하나의 플랫폼에서 관리하는 방향의 도구입니다. MCP를 통해 Codex·Claude Code·Cursor 같은 AI 에이전트에서 자연어로 인프라 작업을 요청할 수도 있습니다.

🔗 [${REPOS[9].href}](${REPOS[9].href})

## 이 10개가 이어지는 흐름

- 기획·실행 → [gstack](${REPOS[0].href})
- 시장조사 → [Last 30 Days](${REPOS[1].href})
- 마케팅 → [Marketing Skills](${REPOS[2].href})
- 알림 → [Novu](${REPOS[3].href})
- 자료 공유 → [Papermark](${REPOS[4].href})
- 사용자 분석 → [OpenReplay](${REPOS[5].href})
- UI → [shadcn/ui](${REPOS[6].href})
- 제품 데모 → [Cap](${REPOS[7].href})
- AI 기능 → [Dify](${REPOS[8].href})
- 배포 → [Devopness](${REPOS[9].href})

예전에는 팀과 여러 SaaS가 필요했던 영역을 이제는 AI와 오픈소스 조합으로 상당 부분 시작할 수 있습니다.
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

function assertRecord(markdown, content) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
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
  if (markdown.includes("\uFFFC")) {
    throw new Error("트레드 이미지 자리표시가 남아 있습니다.");
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
  if (REPOS.length !== 10) {
    throw new Error(`저장소 수가 10개가 아닙니다. ${REPOS.length}`);
  }
  const libs = loadLibs();
  const content = JSON.stringify(libs.markdownToTiptapDoc(PAGE_MARKDOWN));
  assertRecord(PAGE_MARKDOWN, content);
  const extra = {
    pageTitle: PAGE_TITLE,
    repos: REPOS.length,
    links: linkAttrsOf(content).length,
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
