// ADU 클로드 업무 사례 3편을 Pages와 Prompts에 저장한다
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { parseHTML } from "linkedom";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

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

export const SITES = [
  {
    url: "https://adu-usecases-1.vercel.app/",
    expectedPrompts: 48,
    shortName: "1편 사무직 공통편",
  },
  {
    url: "https://adu-usecases-2.vercel.app/",
    expectedPrompts: 64,
    shortName: "2편 직무 실무편",
  },
  {
    url: "https://adu-usecases-3.vercel.app/",
    expectedPrompts: 36,
    shortName: "3편 개인·교육·비영리편",
  },
];

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

function collapseText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function nodeText(el) {
  return collapseText(el?.textContent ?? "");
}

function hasClass(el, name) {
  if (!el) return false;
  if (el.classList?.contains?.(name)) return true;
  return String(el.getAttribute?.("class") ?? "")
    .split(/\s+/)
    .includes(name);
}

/** 유입 추적 쿼리를 빼고 https 주소로 바꾼다. */
export function stripTracking(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "fbclid") {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return String(url)
      .replace(/[?&](?:utm_[^=&#]*|fbclid)=[^&\s)#]*/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

function canonicalUrl(url) {
  const cleaned = stripTracking(url);
  try {
    const parsed = new URL(cleaned);
    if (!parsed.pathname) parsed.pathname = "/";
    return parsed.href;
  } catch {
    return cleaned;
  }
}

function shortNameOf(sourceUrl, title) {
  const site = SITES.find((item) => item.url === sourceUrl);
  if (site?.shortName) return site.shortName;
  return (
    String(title ?? "")
      .replace(/^클로드 업무 사례\s*/, "")
      .replace(/\s*\d+개\s*$/, "")
      .replace(/^\s*[—-]\s*/, "")
      .trim() || "업무 사례"
  );
}

function headingName(h2Text) {
  return String(h2Text ?? "")
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, "")
    .replace(/\s*\d+개\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 섹션 제목에서 이모지와 개수 접미를 빼고 ADU 분류를 만든다. */
export function sectionCategory(h2Text) {
  const name = headingName(h2Text);
  return name ? `ADU · ${name}` : "ADU";
}

function sourceLabel(sourceUrl, title) {
  return `ADU ${shortNameOf(sourceUrl, title)}`;
}

/** 제목·원문 주소·원문 인용 문구가 같으면 중복으로 본다. */
export function isDuplicatePage(row, title, sourceUrl) {
  if (!row) return false;
  if (row.title === title) return true;
  if (sourceUrl && row.source_url && row.source_url === sourceUrl) return true;
  if (!sourceUrl) return false;
  const content = String(row.content ?? "");
  return content.includes(sourceLabel(sourceUrl, title)) && content.includes(sourceUrl);
}

function inlineMarkdown(el) {
  if (!el) return "";
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === 3) {
      out += String(node.textContent ?? "").replace(/\s+/g, " ");
      continue;
    }
    const name = node.nodeName;
    if (name === "BR") {
      out += "\n";
      continue;
    }
    if (name === "STRONG" || name === "B") {
      out += `**${nodeText(node)}**`;
      continue;
    }
    if (name === "EM" || name === "I") {
      out += `*${nodeText(node)}*`;
      continue;
    }
    if (name === "A") {
      const href = stripTracking(node.getAttribute("href") || "");
      const label = nodeText(node) || href;
      out += href ? `[${label}](${href})` : label;
      continue;
    }
    if (name === "SPAN" && hasClass(node, "ct")) {
      out += `**${nodeText(node)}**\n\n`;
      continue;
    }
    if (name === "BUTTON") continue;
    out += inlineMarkdown(node);
  }
  return out
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

function pageTitleOf(document) {
  const fromDoc = nodeText(document.querySelector("title")).replace(
    /\s*\|\s*ADU\s*$/,
    ""
  );
  if (fromDoc) return fromDoc;
  const h1 = document.querySelector("h1");
  if (!h1) return "클로드 업무 사례";
  let raw = "";
  for (const node of h1.childNodes) {
    if (node.nodeName === "BR") raw += " ";
    else raw += node.textContent ?? "";
  }
  return collapseText(raw) || "클로드 업무 사례";
}

function preBody(el) {
  return String(el?.textContent ?? "")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

function cardSummary(card) {
  for (const child of card.children) {
    if (child.tagName === "P") return nodeText(child);
  }
  return nodeText(card.querySelector("p"));
}

function parseCard(card, category, sourceUrl) {
  const title = nodeText(card.querySelector("h4"));
  const tag = nodeText(card.querySelector(".tag"));
  const summary = cardSummary(card);
  const body = preBody(card.querySelector("pre"));
  if (!title) return null;
  const when = tag
    ? summary
      ? `${tag}에서 씁니다. ${summary}`
      : `${tag}에서 씁니다.`
    : summary;
  return {
    title,
    category,
    summary,
    tag,
    body,
    when_to_use: when,
    sections: JSON.stringify([
      { title: "프롬프트", body },
      { title: "사용 환경", body: tag },
      { title: "원본", body: sourceUrl },
    ]),
  };
}

function formatBooknav(el) {
  if (!el) return "";
  const parts = [];
  for (const child of el.children) {
    const label = nodeText(child);
    if (!label) continue;
    if (child.tagName === "A") {
      const href = stripTracking(child.getAttribute("href") || "");
      parts.push(href ? `[${label}](${href})` : label);
    } else {
      parts.push(label);
    }
  }
  return parts.join(" · ");
}

function howtoBlocks(section) {
  const out = [];
  for (const child of section.children) {
    if (child.tagName === "H2") continue;
    const text = inlineMarkdown(child);
    if (text) out.push(text);
  }
  return out;
}

function stuckBlocks(section) {
  const out = [];
  for (const details of section.querySelectorAll("details")) {
    const summary = nodeText(details.querySelector("summary"));
    const answerEl = details.querySelector("p");
    const answer = answerEl
      ? inlineMarkdown(answerEl)
      : collapseText(
          nodeText(details).slice(summary.length)
        );
    if (summary) out.push(`### ${summary}`);
    if (answer) out.push(answer);
  }
  return out;
}

function ctaBlocks(cta) {
  const out = [];
  const heading = nodeText(cta.querySelector("h2"));
  if (heading) out.push(`## ${heading}`);
  const para = cta.querySelector("p");
  const paraText = para ? inlineMarkdown(para) : "";
  if (paraText) out.push(paraText);
  const link = cta.querySelector("a[href]");
  if (link) {
    const href = stripTracking(link.getAttribute("href") || "");
    const label = nodeText(link) || href;
    if (href) out.push(`[${label}](${href})`);
  }
  return out;
}

function assertParsed(parsed, expectedPrompts, sourceUrl) {
  if (parsed.prompts.length !== expectedPrompts) {
    throw new Error(
      `프롬프트 수가 맞지 않습니다. 기대 ${expectedPrompts}, 실제 ${parsed.prompts.length}. ${sourceUrl}`
    );
  }
  if (!parsed.markdown.includes(sourceUrl)) {
    throw new Error(`본문에 원문 주소가 없습니다. ${sourceUrl}`);
  }
  if (!parsed.markdown.includes("막혔을 때")) {
    throw new Error("막혔을 때 절이 없습니다.");
  }
  if (
    parsed.markdown.includes("전체 48") ||
    parsed.markdown.includes("전체 64") ||
    parsed.markdown.includes("전체 36")
  ) {
    throw new Error("필터 칩이 본문에 남아 있습니다.");
  }
  if (/(^|\n)복사(\n|$)/.test(parsed.markdown)) {
    throw new Error("복사 버튼 문구가 본문에 남아 있습니다.");
  }
  const seen = new Set();
  for (const prompt of parsed.prompts) {
    if (!prompt.body || prompt.body.trim() === "복사") {
      throw new Error(`프롬프트 본문이 비었습니다. ${prompt.title}`);
    }
    const key = `${prompt.category}\0${prompt.title}`;
    if (seen.has(key)) {
      throw new Error(`같은 분류에 제목이 겹칩니다. ${prompt.title}`);
    }
    seen.add(key);
  }
}

export function parseUsecaseHtml(html, sourceUrl) {
  const canonical = canonicalUrl(sourceUrl);
  const { document } = parseHTML(String(html ?? ""));
  const title = pageTitleOf(document);
  const blocks = [];
  const prompts = [];

  blocks.push(`# ${title}`);
  blocks.push(`> 원문. [ADU ${shortNameOf(canonical, title)}](${canonical})`);

  const hero = document.querySelector(".hero");
  if (hero) {
    const kicker = nodeText(hero.querySelector(".kicker"));
    const sub = nodeText(hero.querySelector(".sub"));
    const meta = nodeText(hero.querySelector(".meta"));
    if (kicker) blocks.push(kicker);
    if (sub) blocks.push(sub);
    if (meta) blocks.push(meta);
  }

  for (const section of document.querySelectorAll("section")) {
    const h2 = section.querySelector("h2");
    const heading = headingName(h2?.textContent ?? "");
    const cards = [...section.querySelectorAll(".uc")];
    if (cards.length) {
      if (heading) blocks.push(`## ${heading}`);
      const category = sectionCategory(h2?.textContent ?? "");
      for (const card of cards) {
        const item = parseCard(card, category, canonical);
        if (!item) continue;
        prompts.push(item);
        blocks.push(`### ${item.title}`);
        if (item.tag) blocks.push(item.tag);
        if (item.summary) blocks.push(item.summary);
        blocks.push(`\`\`\`\n${item.body}\n\`\`\``);
      }
      continue;
    }
    if (heading === "쓰는 법") {
      blocks.push("## 쓰는 법");
      blocks.push(...howtoBlocks(section));
      continue;
    }
    if (heading === "막혔을 때") {
      blocks.push("## 막혔을 때");
      blocks.push(...stuckBlocks(section));
    }
  }

  const booknav = formatBooknav(document.querySelector(".booknav"));
  if (booknav) blocks.push(booknav);

  const cta = document.querySelector(".cta");
  if (cta) blocks.push(...ctaBlocks(cta));

  const footer = document.querySelector("footer");
  if (footer) {
    const footerText = inlineMarkdown(footer);
    if (footerText) blocks.push(footerText);
  }

  return {
    title,
    markdown: blocks.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim(),
    prompts,
  };
}

async function loadSite(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    throw new Error(`원문을 가져오지 못했습니다. HTTP ${response.status}. ${url}`);
  }
  return response.text();
}

function tableColumns(db, table) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((col) => col.name);
}

function sqliteHasFindability(db) {
  const cols = tableColumns(db, "custom_pages");
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) =>
    cols.includes(name)
  );
}

function findabilityOf(libs, page) {
  const found = libs.preparePageFindability({
    title: page.title,
    content: page.content,
    existingSourceUrl: page.sourceUrl,
  });
  return {
    tags: JSON.stringify(found.tags ?? []),
    sourceUrl: found.sourceUrl || page.sourceUrl,
    searchText: found.searchText ?? "",
  };
}

function findLocalPage(db, title, sourceUrl) {
  const cols = tableColumns(db, "custom_pages");
  const selectCols = cols.includes("source_url")
    ? "id, title, content, source_url"
    : "id, title, content";
  const byTitle = db
    .prepare(
      `SELECT ${selectCols} FROM custom_pages WHERE user_id = ? AND title = ?`
    )
    .get(LOCAL_USER, title);
  if (isDuplicatePage(byTitle, title, sourceUrl)) return byTitle;
  if (sourceUrl && cols.includes("source_url")) {
    const bySource = db
      .prepare(
        `SELECT ${selectCols} FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1`
      )
      .get(LOCAL_USER, sourceUrl);
    if (isDuplicatePage(bySource, title, sourceUrl)) return bySource;
  }
  if (sourceUrl) {
    const label = sourceLabel(sourceUrl, title);
    const byContent = db
      .prepare(
        `SELECT ${selectCols} FROM custom_pages
         WHERE user_id = ? AND content LIKE ?
         LIMIT 1`
      )
      .get(LOCAL_USER, `%${label}%`);
    if (isDuplicatePage(byContent, title, sourceUrl)) return byContent;
  }
  return null;
}

function insertLocalPage(db, page, libs) {
  const existing = findLocalPage(db, page.title, page.sourceUrl);
  if (existing) return { inserted: false, pageId: existing.id };
  const now = page.created_at;
  if (sqliteHasFindability(db)) {
    const found = findabilityOf(libs, page);
    db.prepare(
      `INSERT INTO custom_pages (
         id, user_id, title, content, tags, source_url, search_text, is_favorite, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      found.tags,
      found.sourceUrl,
      found.searchText,
      now,
      now
    );
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(page.id, LOCAL_USER, page.title, page.content, now, now);
  }
  return { inserted: true, pageId: page.id };
}

function insertLocalPrompt(db, prompt, now) {
  const found = db
    .prepare(
      "SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?"
    )
    .get(LOCAL_USER, prompt.title, prompt.category);
  if (found) return false;
  db.prepare(
    `INSERT INTO prompts (
       id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    randomUUID(),
    LOCAL_USER,
    prompt.title,
    prompt.category,
    prompt.summary,
    prompt.when_to_use,
    prompt.sections,
    now,
    now
  );
  return true;
}

/** 운영 DB는 content 검색을 하지 않는다. 타임아웃이 난다. */
async function findProductionPage(supabase, title, sourceUrl) {
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return data[0];
  if (!sourceUrl) return null;
  const bySource = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("source_url", sourceUrl)
    .limit(1);
  if (bySource.error) {
    if (!/source_url/i.test(bySource.error.message)) throw bySource.error;
    return null;
  }
  return bySource.data?.[0] ?? null;
}

async function insertProductionPage(supabase, page, libs) {
  const existing = await findProductionPage(
    supabase,
    page.title,
    page.sourceUrl
  );
  if (existing) return { inserted: false, pageId: existing.id };
  const found = findabilityOf(libs, page);
  const full = {
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    tags: found.tags,
    source_url: found.sourceUrl,
    search_text: found.searchText,
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
    if (retryError) {
      if (/duplicate key|23505/i.test(retryError.message || "")) {
        const again = await findProductionPage(supabase, page.title, page.sourceUrl);
        if (again) return { inserted: false, pageId: again.id };
      }
      throw retryError;
    }
  }
  return { inserted: true, pageId: page.id };
}

async function loadProdPromptKeys(supabase, categories) {
  const keys = new Set();
  for (const category of [...new Set(categories)]) {
    const { data, error } = await supabase
      .from("prompts")
      .select("title")
      .eq("user_id", PROD_USER)
      .eq("category", category);
    if (error) throw error;
    for (const row of data ?? []) {
      keys.add(`${row.title}\0${category}`);
    }
  }
  return keys;
}

async function insertProductionPrompt(supabase, prompt, now) {
  const row = {
    id: randomUUID(),
    user_id: PROD_USER,
    title: prompt.title,
    category: prompt.category,
    summary: prompt.summary,
    when_to_use: prompt.when_to_use,
    sections: prompt.sections,
    is_favorite: 0,
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from("prompts").insert(row);
  if (error) throw error;
}

function createSupabase() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function emptyResult() {
  return { pages: 0, pageSkips: 0, prompts: 0, promptSkips: 0, pageIds: [] };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const parsedSites = [];
  for (const site of SITES) {
    const html = await loadSite(site.url);
    const parsed = parseUsecaseHtml(html, site.url);
    assertParsed(parsed, site.expectedPrompts, site.url);
    parsedSites.push({ ...site, ...parsed });
  }

  const summary = {
    sites: parsedSites.map((site) => ({
      url: site.url,
      title: site.title,
      prompts: site.prompts.length,
    })),
    totalPrompts: parsedSites.reduce((sum, site) => sum + site.prompts.length, 0),
  };
  if (checkOnly) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const libs = loadLibs();
  const db = new Database(resolve(root, "data/mymark.db"));
  const supabase = createSupabase();
  const local = emptyResult();
  const production = emptyResult();
  const now = new Date().toISOString();

  try {
    for (const site of parsedSites) {
      const page = {
        id: randomUUID(),
        title: site.title,
        content: JSON.stringify(libs.markdownToTiptapDoc(site.markdown)),
        sourceUrl: site.url,
        created_at: now,
        updated_at: now,
      };
      const localPage = insertLocalPage(db, page, libs);
      if (localPage.inserted) local.pages += 1;
      else local.pageSkips += 1;
      local.pageIds.push(localPage.pageId);
      page.id = localPage.pageId;

      const prodPage = await insertProductionPage(supabase, page, libs);
      if (prodPage.inserted) production.pages += 1;
      else production.pageSkips += 1;
      production.pageIds.push(prodPage.pageId);

      const categories = site.prompts.map((prompt) => prompt.category);
      const prodKeys = await loadProdPromptKeys(supabase, categories);
      for (const prompt of site.prompts) {
        if (insertLocalPrompt(db, prompt, now)) local.prompts += 1;
        else local.promptSkips += 1;

        const key = `${prompt.title}\0${prompt.category}`;
        if (prodKeys.has(key)) {
          production.promptSkips += 1;
          continue;
        }
        await insertProductionPrompt(supabase, prompt, now);
        prodKeys.add(key);
        production.prompts += 1;
      }
    }
  } finally {
    db.close();
  }

  console.log(
    JSON.stringify(
      {
        ...summary,
        local,
        production,
      },
      null,
      2
    )
  );
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
