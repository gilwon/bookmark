// AI 활용 문서 11건을 Pages에, 재사용 프롬프트 10건을 Prompts에 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const qjcSourceUrl = "https://qjc.app/blog/claude-code-prompt-caching";
const qjcTitle = "프롬프트 캐싱 완벽 가이드: Anthropic이 공개한 Claude Code의 비용 최적화 비밀";
const ai9SourceUrl = "https://fieldby.notion.site/AI-9-3abd730b39538120ad44e38da71eaaa9";
const ai9PageId = "3abd730b-3953-8120-ad44-e38da71eaaa9";
const ai9Title = "구글 무료 AI 툴 9개 총정리";
const playlistSourceUrl = "https://app.notion.com/p/3b1c601852d1809e993cf1dd14e637aa";
const playlistPageId = "3b1c6018-52d1-809e-993c-f1dd14e637aa";
const playlistTitle = "나만의 플레이리스트 빌더 — 프롬프트 & 가이드";
const sunoSourceUrl = "https://app.notion.com/p/30-Suno-3a072cc75bf68110b219f73cfbda69f4";
const sunoPageId = "3a072cc7-5bf6-8110-b219-f73cfbda69f4";
const sunoTitle = "30분 실습 — Suno로 첫 자작곡 초안 만들기";
const copyrightSourceUrl = "https://app.notion.com/p/AI-3a072cc75bf681488106d4e9f17a91ab";
const copyrightPageId = "3a072cc7-5bf6-8148-8106-d4e9f17a91ab";
const copyrightTitle = "AI 음악 시작 전 저작권 체크리스트 — 커버 대신 자작곡으로 출발하기";
const faqSourceUrl = "https://app.notion.com/p/AI-6-3a072cc75bf681b78838f45126566a53";
const faqPageId = "3a072cc7-5bf6-81b7-8838-f45126566a53";
const faqTitle = "음치·초보도 AI 음악 채널을 시작할 수 있을까? 현실 답변 6가지";
const thumbnailSourceUrl = "https://app.notion.com/p/AI-5-3a072cc75bf68198949cddd2ccf0bc70";
const thumbnailPageId = "3a072cc7-5bf6-8198-949c-ddd2ccf0bc70";
const thumbnailTitle = "클릭되는 AI 썸네일 만들기 — 실패를 줄이는 5가지 규칙";
const uploadSourceUrl = "https://app.notion.com/p/AI-4-3a072cc75bf681e19849fadbf049c988";
const uploadPageId = "3a072cc7-5bf6-81e1-9849-fadbf049c988";
const uploadTitle = "AI 음악을 유튜브에 올릴 때 확인할 4가지 — 고지·권리·독창성·검수";
const teamSourceUrl = "https://app.notion.com/p/AI-3a072cc75bf681378c8ecf06390d4a91";
const teamPageId = "3a072cc7-5bf6-8137-8c8e-cf06390d4a91";
const teamTitle = "혼자 운영하는 AI 콘텐츠 팀 만들기 — 역할 분담표와 지시문";
const analyticsSourceUrl = "https://app.notion.com/p/CTR-30-3a072cc75bf681168096dc979fba9b68";
const analyticsPageId = "3a072cc7-5bf6-8116-8096-dc979fba9b68";
const analyticsTitle = "조회수 오른 영상 분석법 — CTR·30초·지속률 진단표";
const brandSourceUrl = "https://app.notion.com/p/AI-5-3a072cc75bf681c49eedca06d317f322";
const brandPageId = "3a072cc7-5bf6-81c4-9eed-ca06d317f322";
const brandTitle = "AI에게 맡기면 안 되는 5가지 — 자동화해도 내 브랜드를 지키는 법";
const notionEndpoint = "https://app.notion.com/api/v3/loadPageChunk";
const playlistPromptCategory = "AI · 플레이리스트 빌더";
const sunoPromptCategory = "Suno · 첫 자작곡 실습";
const thumbnailPromptCategory = "AI · 썸네일 제작";
const teamPromptCategory = "AI · 콘텐츠 팀";
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const retryDelays = [15000, 30000];
let lastRequestAt = 0;

const ai9SectionNames = [
  "Mixboard",
  "Opal",
  "Pomelli",
  "Learn Your Way",
  "Flow Music",
  "NotebookLM",
  "Google AI Studio",
  "Stitch",
  "Disco",
];

const playlistPromptConfigs = {
  "🎧 Spotify에서 만들기": {
    title: "플레이리스트 빌더 · Spotify 자동 생성",
    summary: "대화 맥락의 취향을 바탕으로 Spotify 플레이리스트를 생성하는 프롬프트입니다.",
    whenToUse: "Spotify에서 바로 재생할 개인화 플레이리스트를 만들 때 사용하세요.",
  },
  "▶️ YouTube Music에서 만들기": {
    title: "플레이리스트 빌더 · YouTube Music 자동 생성",
    summary: "대화 맥락의 취향을 바탕으로 YouTube Music 플레이리스트를 생성하는 프롬프트입니다.",
    whenToUse: "YouTube Music에서 바로 재생할 개인화 플레이리스트를 만들 때 사용하세요.",
  },
  "📝 Spotify·YouTube Music을 사용할 수 없을 때": {
    title: "플레이리스트 빌더 · 연결 없이 목록 생성",
    summary: "음악 서비스 연결 없이 곡 목록과 플레이리스트 구성을 만드는 프롬프트입니다.",
    whenToUse: "Spotify나 YouTube Music 연결 없이 플레이리스트 목록이 필요할 때 사용하세요.",
  },
};

const sunoPromptConfigs = {
  "268e2430-32a4-40a9-9e41-1a12abc602df": {
    title: "Suno 첫 자작곡 · 장면 입력 템플릿",
    summary: "자작곡의 화자와 장면을 구체화하는 입력 양식입니다.",
    whenToUse: "가사를 쓰기 전에 곡의 핵심 장면을 정리할 때 사용하세요.",
  },
  "6363bac2-d6ab-4be6-b514-a7b22d4a9a78": {
    title: "Suno 첫 자작곡 · 발라드 가사 초안",
    summary: "구체적인 장면으로 한국어 발라드 가사 초안을 만드는 프롬프트입니다.",
    whenToUse: "정리한 장면을 3분 안팎의 발라드 가사로 발전시킬 때 사용하세요.",
  },
  "64ffcfb2-408f-4a2a-8e53-32a6c19d931b": {
    title: "Suno 첫 자작곡 · 스타일 프롬프트",
    summary: "피아노 발라드의 보컬과 편곡 방향을 지정하는 스타일 프롬프트입니다.",
    whenToUse: "Suno에서 곡의 장르와 보컬, 악기, 분위기를 지정할 때 사용하세요.",
  },
  "b65b1d19-306d-47d5-a07c-4b65fe870faf": {
    title: "Suno 첫 자작곡 · 제외 스타일",
    summary: "원하지 않는 장르와 편곡 요소를 제외하는 스타일 목록입니다.",
    whenToUse: "Suno 생성 결과에서 피하고 싶은 음악 요소를 지정할 때 사용하세요.",
  },
};

const thumbnailPromptConfigs = {
  "398342b2-34e7-4516-b8f1-25b5480a044a": {
    title: "AI 썸네일 · 프롬프트 공식",
    summary: "썸네일의 장면과 구도, 여백을 지정하는 프롬프트 입력 공식입니다.",
    whenToUse: "AI로 클릭을 유도하는 썸네일 구도를 설계할 때 사용하세요.",
  },
  "763b77e4-e4fb-4439-8aaf-0b80f78b8162": {
    title: "AI 썸네일 · 발라드 채널 예시",
    summary: "발라드 음악 채널용 썸네일을 만드는 예시 프롬프트입니다.",
    whenToUse: "감성 발라드 영상의 썸네일 시안을 생성할 때 사용하세요.",
  },
};

const teamPromptConfigs = {
  "0d9cdf03-682f-4e2a-9c6c-3143fee4c6bc": {
    title: "AI 콘텐츠 팀 · 역할 카드 템플릿",
    summary: "AI 콘텐츠 팀원의 역할과 입력, 출력 기준을 정하는 템플릿입니다.",
    whenToUse: "혼자 운영하는 콘텐츠 작업을 AI 역할별로 분담할 때 사용하세요.",
  },
};

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { fetchUrlAsMarkdown } = require(resolve(root, "src/lib/url-to-markdown.ts"));
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));

const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function richText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((fragment) => {
      if (typeof fragment === "string") return fragment;
      if (!Array.isArray(fragment)) return "";
      return typeof fragment[0] === "string" ? fragment[0] : richText(fragment[0]);
    })
    .join("");
}

function markdownRichText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((fragment) => {
      if (typeof fragment === "string") return fragment;
      if (!Array.isArray(fragment)) return "";
      const text = typeof fragment[0] === "string" ? fragment[0] : markdownRichText(fragment[0]);
      const href = Array.isArray(fragment[1])
        ? fragment[1].find(
            (annotation) =>
              Array.isArray(annotation) &&
              annotation[0] === "a" &&
              typeof annotation[1] === "string" &&
              annotation[1].startsWith("https://")
          )?.[1]
        : undefined;
      return href ? `[${text}](${href})` : text;
    })
    .join("");
}

function titleOf(block) {
  return richText(block?.properties?.title).trim();
}

function linkOf(block) {
  return richText(block?.properties?.link).trim();
}

async function requestNotionChunk(id) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < 1200) await pause(1200 - elapsed);
    const response = await fetch(notionEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        pageId: id,
        limit: 999999,
        cursor: { stack: [] },
        chunkNumber: 0,
        verticalColumns: false,
      }),
    });
    lastRequestAt = Date.now();
    if (response.ok) return response.json();
    const body = await response.text();
    if (![429, 503].includes(response.status)) {
      throw new Error(`Notion HTTP ${response.status} (${id}): ${body.slice(0, 300)}`);
    }
    if (attempt === retryDelays.length) {
      throw new Error(`Notion HTTP ${response.status} 재시도 한도 초과 (${id})`);
    }
    await pause(retryDelays[attempt]);
  }
  throw new Error(`Notion 요청 실패: ${id}`);
}

async function collectNotionBlocks(pageId) {
  const blocks = new Map();
  const queue = [pageId];
  const queued = new Set(queue);
  const reachable = new Set(queue);
  let requestCount = 0;

  while (queue.length) {
    const id = queue.shift();
    const chunk = await requestNotionChunk(id);
    requestCount += 1;
    for (const [blockId, record] of Object.entries(chunk.recordMap?.block ?? {})) {
      const block = record.value?.value;
      if (block) blocks.set(blockId, block);
    }
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const blockId of reachable) {
        const block = blocks.get(blockId);
        if (!block || (block.type === "page" && blockId !== pageId)) continue;
        for (const childId of block.content ?? []) {
          if (!reachable.has(childId)) {
            reachable.add(childId);
            foundChild = true;
          }
          if (!blocks.has(childId) && !queued.has(childId)) {
            queue.push(childId);
            queued.add(childId);
          }
        }
      }
    }
  }

  const missing = [...reachable].filter((id) => !blocks.has(id));
  return { blocks, missing, reachable, requestCount };
}

function buildNotionDocument(source, pageId, sourceUrl) {
  const page = source.blocks.get(pageId);
  if (!page) throw new Error(`Notion root 블록을 찾지 못했습니다: ${pageId}`);
  const codeBlocks = [];
  const rendered = new Set();

  function render(id, activeSection = "", path = new Set()) {
    const block = source.blocks.get(id);
    if (!block || path.has(id)) return "";
    rendered.add(id);
    const nextPath = new Set(path).add(id);
    const title = titleOf(block);
    const markdownTitle = markdownRichText(block.properties?.title).trim();
    const nextSection = block.type === "sub_header" ? title : activeSection;
    const childIds = block.type === "page" && id !== pageId ? [] : block.content ?? [];
    const children = childIds
      .map((childId) => render(childId, nextSection, nextPath))
      .filter(Boolean)
      .join("\n\n");

    if (block.type === "callout") {
      return `:::callout\n${[markdownTitle, children].filter(Boolean).join("\n\n")}\n:::`;
    }
    if (block.type === "header") return [`## ${markdownTitle}`, children].filter(Boolean).join("\n\n");
    if (block.type === "header_4") return [`#### ${markdownTitle}`, children].filter(Boolean).join("\n\n");
    if (block.type === "sub_header") return [`## ${markdownTitle}`, children].filter(Boolean).join("\n\n");
    if (block.type === "sub_sub_header") return [`### ${markdownTitle}`, children].filter(Boolean).join("\n\n");
    if (block.type === "divider") return "---";
    if (block.type === "quote") {
      return [`> ${markdownTitle.replace(/\n/g, "\n> ")}`, children].filter(Boolean).join("\n\n");
    }
    if (block.type === "numbered_list") {
      return [`1. ${markdownTitle}`, children].filter(Boolean).join("\n");
    }
    if (block.type === "bulleted_list") {
      return [`- ${markdownTitle}`, children].filter(Boolean).join("\n");
    }
    if (block.type === "to_do") {
      const checked = richText(block.properties?.checked) === "Yes" ? "x" : " ";
      return [`- [${checked}] ${markdownTitle}`, children].filter(Boolean).join("\n");
    }
    if (block.type === "code") {
      codeBlocks.push({ id, section: activeSection, body: title });
      return `\`\`\`\n${title}\n\`\`\``;
    }
    if (block.type === "table") {
      const columns = block.format?.table_block_column_order ?? [];
      const rows = (block.content ?? []).map((rowId) => {
        const row = source.blocks.get(rowId);
        return columns.map((columnId) =>
          markdownRichText(row?.properties?.[columnId])
            .replace(/\|/g, "\\|")
            .replace(/\n/g, " / ")
            .trim()
        );
      });
      if (!rows.length || !columns.length) return children;
      return rows
        .map(
          (row, index) =>
            `| ${row.join(" | ")} |${index === 0 ? `\n| ${columns.map(() => "---").join(" | ")} |` : ""}`
        )
        .join("\n");
    }
    if (block.type === "table_row") return "";
    if (block.type === "bookmark") {
      const link = linkOf(block);
      return [link ? `[${link}](${link})` : title, children].filter(Boolean).join("\n\n");
    }
    return [markdownTitle, children].filter(Boolean).join("\n\n");
  }

  const body = (page.content ?? []).map((id) => render(id)).filter(Boolean).join("\n\n");
  return {
    title: titleOf(page),
    markdown: [`# ${titleOf(page)}`, `> 원문. [Notion](${sourceUrl})`, body]
      .filter(Boolean)
      .join("\n\n"),
    codeBlocks,
    renderedCount: rendered.size,
  };
}

const qjc = await fetchUrlAsMarkdown(qjcSourceUrl);
const ai9Source = await collectNotionBlocks(ai9PageId);
const playlistSource = await collectNotionBlocks(playlistPageId);
const sunoSource = await collectNotionBlocks(sunoPageId);
const copyrightSource = await collectNotionBlocks(copyrightPageId);
const faqSource = await collectNotionBlocks(faqPageId);
const thumbnailSource = await collectNotionBlocks(thumbnailPageId);
const uploadSource = await collectNotionBlocks(uploadPageId);
const teamSource = await collectNotionBlocks(teamPageId);
const analyticsSource = await collectNotionBlocks(analyticsPageId);
const brandSource = await collectNotionBlocks(brandPageId);
const ai9Document = buildNotionDocument(ai9Source, ai9PageId, ai9SourceUrl);
const playlistDocument = buildNotionDocument(playlistSource, playlistPageId, playlistSourceUrl);
const sunoDocument = buildNotionDocument(sunoSource, sunoPageId, sunoSourceUrl);
const copyrightDocument = buildNotionDocument(copyrightSource, copyrightPageId, copyrightSourceUrl);
const faqDocument = buildNotionDocument(faqSource, faqPageId, faqSourceUrl);
const thumbnailDocument = buildNotionDocument(thumbnailSource, thumbnailPageId, thumbnailSourceUrl);
const uploadDocument = buildNotionDocument(uploadSource, uploadPageId, uploadSourceUrl);
const teamDocument = buildNotionDocument(teamSource, teamPageId, teamSourceUrl);
const analyticsDocument = buildNotionDocument(analyticsSource, analyticsPageId, analyticsSourceUrl);
const brandDocument = buildNotionDocument(brandSource, brandPageId, brandSourceUrl);
const pages = [
  { title: qjc.title, markdown: qjc.markdown },
  { title: ai9Document.title, markdown: ai9Document.markdown },
  { title: playlistDocument.title, markdown: playlistDocument.markdown },
  { title: sunoDocument.title, markdown: sunoDocument.markdown },
  { title: copyrightDocument.title, markdown: copyrightDocument.markdown },
  { title: faqDocument.title, markdown: faqDocument.markdown },
  { title: thumbnailDocument.title, markdown: thumbnailDocument.markdown },
  { title: uploadDocument.title, markdown: uploadDocument.markdown },
  { title: teamDocument.title, markdown: teamDocument.markdown },
  { title: analyticsDocument.title, markdown: analyticsDocument.markdown },
  { title: brandDocument.title, markdown: brandDocument.markdown },
].map((page) => ({
  ...page,
  content: JSON.stringify(markdownToTiptapDoc(page.markdown)),
}));
const playlistPrompts = playlistDocument.codeBlocks.map(({ section, body }) => {
  const config = playlistPromptConfigs[section];
  if (!config) throw new Error(`프롬프트 섹션을 찾지 못했습니다: ${section}`);
  return {
    title: config.title,
    category: playlistPromptCategory,
    summary: config.summary,
    when_to_use: config.whenToUse,
    sections: JSON.stringify([
      { title: "프롬프트", body },
      { title: "관련 Page", body: playlistDocument.title },
      { title: "원문 Notion", body: playlistSourceUrl },
    ]),
    body,
  };
});
function promptsFromCodes(document, configs, category, sourceUrl) {
  return document.codeBlocks.filter(({ id }) => configs[id]).map(({ id, body }) => {
    const config = configs[id];
    return {
      title: config.title,
      category,
      summary: config.summary,
      when_to_use: config.whenToUse,
      sections: JSON.stringify([
        { title: "프롬프트", body },
        { title: "관련 Page", body: document.title },
        { title: "원문 Notion", body: sourceUrl },
      ]),
      body,
    };
  });
}

const sunoPrompts = promptsFromCodes(sunoDocument, sunoPromptConfigs, sunoPromptCategory, sunoSourceUrl);
const thumbnailPrompts = promptsFromCodes(
  thumbnailDocument,
  thumbnailPromptConfigs,
  thumbnailPromptCategory,
  thumbnailSourceUrl
);
const teamPrompts = promptsFromCodes(teamDocument, teamPromptConfigs, teamPromptCategory, teamSourceUrl);
const prompts = [...playlistPrompts, ...sunoPrompts, ...thumbnailPrompts, ...teamPrompts];

function typeCounts(source) {
  const counts = {};
  for (const block of source.blocks.values()) counts[block.type] = (counts[block.type] ?? 0) + 1;
  return counts;
}

function validateNotionDocument(label, source, document, pageId, expected) {
  const rootBlock = source.blocks.get(pageId);
  const actualTypes = typeCounts(source);
  if (document.title !== expected.title) throw new Error(`${label} 제목 불일치: ${document.title}`);
  if (source.blocks.size !== expected.blocks || source.missing.length) {
    throw new Error(`${label} 블록 불일치: ${source.blocks.size}개, 누락 ${source.missing.length}개`);
  }
  if ((rootBlock?.content ?? []).length !== expected.rootChildren) {
    throw new Error(`${label} root children 불일치: ${(rootBlock?.content ?? []).length}개`);
  }
  if (
    Object.keys(actualTypes).length !== Object.keys(expected.types).length ||
    Object.entries(expected.types).some(([type, count]) => actualTypes[type] !== count)
  ) {
    throw new Error(`${label} 타입 불일치: ${JSON.stringify(actualTypes)}`);
  }
  if (document.renderedCount !== source.reachable.size - 1) {
    throw new Error(`${label} 본문 렌더 누락: ${document.renderedCount}/${source.reachable.size - 1}`);
  }
}

const ai9Blocks = [...ai9Source.blocks.values()];
const ai9Sections = ai9Blocks.filter((block) => block.type === "sub_header");
const ai9Bookmarks = ai9Blocks.filter((block) => block.type === "bookmark");
const playlistBlocks = [...playlistSource.blocks.values()];
const playlistSections = playlistBlocks.filter((block) => block.type === "sub_header");
const playlistCodes = playlistBlocks.filter((block) => block.type === "code");
const sunoCodes = [...sunoSource.blocks.values()].filter((block) => block.type === "code");
const copyrightCodes = [...copyrightSource.blocks.values()].filter((block) => block.type === "code");
const faqCodes = [...faqSource.blocks.values()].filter((block) => block.type === "code");
const thumbnailCodes = [...thumbnailSource.blocks.values()].filter((block) => block.type === "code");
const uploadCodes = [...uploadSource.blocks.values()].filter((block) => block.type === "code");
const teamCodes = [...teamSource.blocks.values()].filter((block) => block.type === "code");
const analyticsCodes = [...analyticsSource.blocks.values()].filter((block) => block.type === "code");
const brandCodes = [...brandSource.blocks.values()].filter((block) => block.type === "code");
const qjcRequiredSections = [
  "프롬프트 캐싱이란 무엇인가",
  "Anthropic이 공개한 6가지 캐싱 최적화 전략",
  "Auto-caching: 캐시 관리의 자동화",
  "실무 적용 체크리스트",
  "FAQ",
];

const sourceUrls = [
  qjcSourceUrl,
  ai9SourceUrl,
  playlistSourceUrl,
  sunoSourceUrl,
  copyrightSourceUrl,
  faqSourceUrl,
  thumbnailSourceUrl,
  uploadSourceUrl,
  teamSourceUrl,
  analyticsSourceUrl,
  brandSourceUrl,
];
if (new Set(sourceUrls).size !== 11) throw new Error("원문 URL이 중복됐습니다.");
for (const sourceUrl of sourceUrls) {
  if (new URL(sourceUrl).search) throw new Error(`원문 URL에 query가 있습니다: ${sourceUrl}`);
}
if (qjc.title !== qjcTitle) throw new Error(`QJC 제목 불일치: ${qjc.title}`);
if (qjc.sourceUrl !== qjcSourceUrl || new URL(qjc.sourceUrl).search) {
  throw new Error("QJC 원문 URL이 깨끗하지 않습니다.");
}
if (qjc.markdown.length < 7000) throw new Error(`QJC 본문이 너무 짧습니다: ${qjc.markdown.length}자`);
for (const section of qjcRequiredSections) {
  if (!qjc.markdown.includes(section)) throw new Error(`QJC 필수 섹션 누락: ${section}`);
}
validateNotionDocument("AI 9 Notion", ai9Source, ai9Document, ai9PageId, {
  title: ai9Title,
  blocks: 61,
  rootChildren: 60,
  types: { page: 1, callout: 1, sub_header: 9, text: 41, bookmark: 9 },
});
validateNotionDocument("플레이리스트 Notion", playlistSource, playlistDocument, playlistPageId, {
  title: playlistTitle,
  blocks: 49,
  rootChildren: 8,
  types: {
    page: 1,
    callout: 3,
    header_4: 1,
    sub_header: 3,
    divider: 1,
    text: 12,
    quote: 1,
    sub_sub_header: 8,
    numbered_list: 11,
    code: 3,
    bulleted_list: 5,
  },
});
validateNotionDocument("Suno Notion", sunoSource, sunoDocument, sunoPageId, {
  title: sunoTitle,
  blocks: 61,
  rootChildren: 52,
  types: {
    page: 3,
    quote: 1,
    text: 17,
    header: 7,
    bulleted_list: 10,
    code: 5,
    to_do: 10,
    table: 1,
    table_row: 6,
    divider: 1,
  },
});
validateNotionDocument("저작권 Notion", copyrightSource, copyrightDocument, copyrightPageId, {
  title: copyrightTitle,
  blocks: 58,
  rootChildren: 55,
  types: {
    page: 3,
    quote: 2,
    text: 8,
    header: 5,
    numbered_list: 4,
    sub_header: 3,
    bulleted_list: 21,
    to_do: 10,
    code: 1,
    divider: 1,
  },
});
validateNotionDocument("FAQ Notion", faqSource, faqDocument, faqPageId, {
  title: faqTitle,
  blocks: 44,
  rootChildren: 40,
  types: { page: 4, quote: 1, text: 14, divider: 4, header: 9, to_do: 5, numbered_list: 7 },
});
validateNotionDocument("썸네일 Notion", thumbnailSource, thumbnailDocument, thumbnailPageId, {
  title: thumbnailTitle,
  blocks: 52,
  rootChildren: 49,
  types: {
    page: 3,
    quote: 1,
    text: 14,
    divider: 4,
    header: 9,
    bulleted_list: 2,
    numbered_list: 11,
    code: 2,
    sub_header: 1,
    to_do: 5,
  },
});
validateNotionDocument("업로드 Notion", uploadSource, uploadDocument, uploadPageId, {
  title: uploadTitle,
  blocks: 62,
  rootChildren: 49,
  types: {
    page: 3,
    quote: 3,
    text: 13,
    header: 6,
    bulleted_list: 10,
    sub_header: 2,
    table: 2,
    to_do: 12,
    table_row: 10,
    divider: 1,
  },
});
validateNotionDocument("콘텐츠 팀 Notion", teamSource, teamDocument, teamPageId, {
  title: teamTitle,
  blocks: 50,
  rootChildren: 40,
  types: {
    page: 3,
    quote: 1,
    text: 13,
    divider: 3,
    header: 6,
    table: 1,
    bulleted_list: 9,
    numbered_list: 3,
    sub_header: 3,
    table_row: 7,
    code: 1,
  },
});
validateNotionDocument("성과 분석 Notion", analyticsSource, analyticsDocument, analyticsPageId, {
  title: analyticsTitle,
  blocks: 56,
  rootChildren: 44,
  types: {
    page: 3,
    quote: 1,
    text: 17,
    divider: 3,
    header: 8,
    bulleted_list: 9,
    table: 2,
    numbered_list: 3,
    table_row: 9,
    code: 1,
  },
});
validateNotionDocument("브랜드 Notion", brandSource, brandDocument, brandPageId, {
  title: brandTitle,
  blocks: 49,
  rootChildren: 41,
  types: {
    page: 2,
    quote: 1,
    text: 14,
    divider: 4,
    header: 10,
    numbered_list: 3,
    table: 1,
    bulleted_list: 3,
    to_do: 5,
    table_row: 6,
  },
});
if (ai9Sections.length !== 9 || ai9Bookmarks.length !== 9) {
  throw new Error(`AI 9 Notion 구성 불일치: 섹션 ${ai9Sections.length}개, 북마크 ${ai9Bookmarks.length}개`);
}
for (const section of ai9SectionNames) {
  if (!ai9Sections.some((block) => titleOf(block).includes(section))) {
    throw new Error(`AI 9 Notion 필수 섹션 누락: ${section}`);
  }
}
if (!ai9Document.markdown.includes(ai9SourceUrl)) throw new Error("AI 9 Notion 원문 URL이 누락됐습니다.");
if (playlistSections.length !== 3 || playlistCodes.length !== 3 || playlistPrompts.length !== 3) {
  throw new Error(
    `플레이리스트 구성 불일치: 섹션 ${playlistSections.length}개, code ${playlistCodes.length}개, prompt ${playlistPrompts.length}개`
  );
}
for (const section of Object.keys(playlistPromptConfigs)) {
  if (!playlistSections.some((block) => titleOf(block) === section)) {
    throw new Error(`플레이리스트 필수 섹션 누락: ${section}`);
  }
}
if (!playlistDocument.markdown.includes(playlistSourceUrl) || playlistPrompts.some((prompt) => !prompt.body)) {
  throw new Error("플레이리스트 원문 URL 또는 프롬프트 본문이 누락됐습니다.");
}
if (sunoCodes.length !== 5 || sunoPrompts.length !== 4) {
  throw new Error(`Suno 구성 불일치: code ${sunoCodes.length}개, prompt ${sunoPrompts.length}개`);
}
for (const id of Object.keys(sunoPromptConfigs)) {
  if (!sunoDocument.codeBlocks.some((block) => block.id === id)) {
    throw new Error(`Suno 필수 프롬프트 누락: ${id}`);
  }
}
if (copyrightCodes.length !== 1 || copyrightDocument.codeBlocks.length !== 1) {
  throw new Error(`저작권 code 수 불일치: ${copyrightCodes.length}개`);
}
if (faqCodes.length || faqDocument.codeBlocks.length) throw new Error(`FAQ code 수 불일치: ${faqCodes.length}개`);
if (thumbnailCodes.length !== 2 || thumbnailPrompts.length !== 2) {
  throw new Error(`썸네일 구성 불일치: code ${thumbnailCodes.length}개, prompt ${thumbnailPrompts.length}개`);
}
if (uploadCodes.length || uploadDocument.codeBlocks.length) {
  throw new Error(`업로드 code 수 불일치: ${uploadCodes.length}개`);
}
if (teamCodes.length !== 1 || teamPrompts.length !== 1) {
  throw new Error(`콘텐츠 팀 구성 불일치: code ${teamCodes.length}개, prompt ${teamPrompts.length}개`);
}
if (analyticsCodes.length !== 1 || analyticsDocument.codeBlocks.length !== 1) {
  throw new Error(`성과 분석 code 수 불일치: ${analyticsCodes.length}개`);
}
if (brandCodes.length || brandDocument.codeBlocks.length) {
  throw new Error(`브랜드 code 수 불일치: ${brandCodes.length}개`);
}
for (const [document, configs] of [
  [thumbnailDocument, thumbnailPromptConfigs],
  [teamDocument, teamPromptConfigs],
]) {
  for (const id of Object.keys(configs)) {
    if (!document.codeBlocks.some((block) => block.id === id)) {
      throw new Error(`${document.title} 필수 프롬프트 누락: ${id}`);
    }
  }
}
for (const [document, sourceUrl] of [
  [sunoDocument, sunoSourceUrl],
  [copyrightDocument, copyrightSourceUrl],
  [faqDocument, faqSourceUrl],
  [thumbnailDocument, thumbnailSourceUrl],
  [uploadDocument, uploadSourceUrl],
  [teamDocument, teamSourceUrl],
  [analyticsDocument, analyticsSourceUrl],
  [brandDocument, brandSourceUrl],
]) {
  if (!document.markdown.includes(sourceUrl)) throw new Error(`${document.title} 원문 URL이 누락됐습니다.`);
}
for (const [document, link] of [
  [sunoDocument, "[Suno](https://suno.com/)"],
  [copyrightDocument, "[Suno 이용약관](https://about.suno.com/terms)"],
  [
    uploadDocument,
    "[YouTube 합성·변경 콘텐츠 고지 공식 안내](https://support.google.com/youtube/answer/14328491)",
  ],
]) {
  if (!document.markdown.includes(link)) throw new Error(`${document.title} 인라인 링크 누락: ${link}`);
}
if (pages.length !== 11 || prompts.length !== 10 || prompts.some((prompt) => !prompt.body)) {
  throw new Error("가져올 Pages 또는 Prompts 수가 다르거나 본문이 비었습니다.");
}
for (const page of pages) {
  const doc = JSON.parse(page.content);
  if (doc.type !== "doc" || !doc.content?.length) throw new Error(`빈 TipTap 문서: ${page.title}`);
}

if (process.argv.includes("--check")) {
  console.log({
    pages: pages.length,
    prompts: prompts.length,
    qjc: { title: qjc.title, markdownLength: qjc.markdown.length, sourceUrl: qjc.sourceUrl },
    ai9: {
      title: ai9Document.title,
      blockCount: ai9Source.blocks.size,
      requestCount: ai9Source.requestCount,
      missingBlocks: ai9Source.missing.length,
      sectionCount: ai9Sections.length,
      bookmarkCount: ai9Bookmarks.length,
    },
    playlist: {
      title: playlistDocument.title,
      blockCount: playlistSource.blocks.size,
      requestCount: playlistSource.requestCount,
      missingBlocks: playlistSource.missing.length,
      sectionCount: playlistSections.length,
      codeCount: playlistCodes.length,
      promptTitles: playlistPrompts.map((prompt) => prompt.title),
      promptLengths: playlistPrompts.map((prompt) => prompt.body.length),
    },
    suno: {
      title: sunoDocument.title,
      blockCount: sunoSource.blocks.size,
      rootChildren: sunoSource.blocks.get(sunoPageId).content.length,
      types: typeCounts(sunoSource),
      codeCount: sunoCodes.length,
      promptTitles: sunoPrompts.map((prompt) => prompt.title),
    },
    copyright: {
      title: copyrightDocument.title,
      blockCount: copyrightSource.blocks.size,
      rootChildren: copyrightSource.blocks.get(copyrightPageId).content.length,
      types: typeCounts(copyrightSource),
      codeCount: copyrightCodes.length,
      promptCount: 0,
    },
    faq: {
      title: faqDocument.title,
      blockCount: faqSource.blocks.size,
      rootChildren: faqSource.blocks.get(faqPageId).content.length,
      types: typeCounts(faqSource),
      codeCount: faqCodes.length,
      promptCount: 0,
    },
    thumbnail: {
      title: thumbnailDocument.title,
      blockCount: thumbnailSource.blocks.size,
      rootChildren: thumbnailSource.blocks.get(thumbnailPageId).content.length,
      types: typeCounts(thumbnailSource),
      codeCount: thumbnailCodes.length,
      promptTitles: thumbnailPrompts.map((prompt) => prompt.title),
    },
    upload: {
      title: uploadDocument.title,
      blockCount: uploadSource.blocks.size,
      rootChildren: uploadSource.blocks.get(uploadPageId).content.length,
      types: typeCounts(uploadSource),
      codeCount: uploadCodes.length,
      promptCount: 0,
    },
    team: {
      title: teamDocument.title,
      blockCount: teamSource.blocks.size,
      rootChildren: teamSource.blocks.get(teamPageId).content.length,
      types: typeCounts(teamSource),
      codeCount: teamCodes.length,
      promptTitles: teamPrompts.map((prompt) => prompt.title),
    },
    analytics: {
      title: analyticsDocument.title,
      blockCount: analyticsSource.blocks.size,
      rootChildren: analyticsSource.blocks.get(analyticsPageId).content.length,
      types: typeCounts(analyticsSource),
      codeCount: analyticsCodes.length,
      promptCount: 0,
    },
    brand: {
      title: brandDocument.title,
      blockCount: brandSource.blocks.size,
      rootChildren: brandSource.blocks.get(brandPageId).content.length,
      types: typeCounts(brandSource),
      codeCount: brandCodes.length,
      promptCount: 0,
    },
    tiptapNodes: Object.fromEntries(pages.map((page) => [page.title, JSON.parse(page.content).content.length])),
  });
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
}

const now = new Date().toISOString();
function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = {
    pages: 0,
    pageUpdates: 0,
    pageSkips: 0,
    prompts: 0,
    promptUpdates: 0,
    promptSkips: 0,
    pageIds: {},
    promptIds: {},
  };
  const findPage = db.prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND title = ?");
  const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
  const updatePage = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
  const findPrompt = db.prepare("SELECT id, summary, when_to_use, sections FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
  const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
  const updatePrompt = db.prepare("UPDATE prompts SET summary = ?, when_to_use = ?, sections = ?, updated_at = ? WHERE id = ? AND user_id = ?");

  db.transaction(() => {
    for (const page of pages) {
      const existing = findPage.get(localUser, page.title);
      if (!existing) {
        const id = randomUUID();
        insertPage.run(id, localUser, page.title, page.content, now, now);
        result.pages += 1;
        result.pageIds[page.title] = id;
      } else {
        result.pageIds[page.title] = existing.id;
        if (existing.content !== page.content) {
          updatePage.run(page.content, now, existing.id, localUser);
          result.pageUpdates += 1;
        } else result.pageSkips += 1;
      }
    }
    for (const prompt of prompts) {
      const existing = findPrompt.get(localUser, prompt.title, prompt.category);
      if (!existing) {
        const id = randomUUID();
        insertPrompt.run(id, localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now);
        result.prompts += 1;
        result.promptIds[prompt.title] = id;
      } else {
        result.promptIds[prompt.title] = existing.id;
        if (
          existing.summary !== prompt.summary ||
          existing.when_to_use !== prompt.when_to_use ||
          existing.sections !== prompt.sections
        ) {
          updatePrompt.run(prompt.summary, prompt.when_to_use, prompt.sections, now, existing.id, localUser);
          result.promptUpdates += 1;
        } else result.promptSkips += 1;
      }
    }
  })();
  db.close();
  return result;
}

async function importProduction() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = {
    pages: 0,
    pageUpdates: 0,
    pageSkips: 0,
    prompts: 0,
    promptUpdates: 0,
    promptSkips: 0,
    pageIds: {},
    promptIds: {},
  };
  for (const page of pages) {
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, content")
      .eq("user_id", productionUser)
      .eq("title", page.title)
      .limit(1);
    if (error) throw error;
    const existing = data?.[0];
    if (!existing) {
      const id = randomUUID();
      const { error: insertError } = await supabase.from("custom_pages").insert({
        id,
        user_id: productionUser,
        title: page.title,
        content: page.content,
        created_at: now,
        updated_at: now,
      });
      if (insertError) throw insertError;
      result.pages += 1;
      result.pageIds[page.title] = id;
    } else {
      result.pageIds[page.title] = existing.id;
      if (existing.content !== page.content) {
        const { error: updateError } = await supabase
          .from("custom_pages")
          .update({ content: page.content, updated_at: now })
          .eq("id", existing.id)
          .eq("user_id", productionUser);
        if (updateError) throw updateError;
        result.pageUpdates += 1;
      } else result.pageSkips += 1;
    }
  }
  for (const prompt of prompts) {
    const { data, error } = await supabase
      .from("prompts")
      .select("id, summary, when_to_use, sections")
      .eq("user_id", productionUser)
      .eq("title", prompt.title)
      .eq("category", prompt.category)
      .limit(1);
    if (error) throw error;
    const existing = data?.[0];
    if (!existing) {
      const id = randomUUID();
      const { error: insertError } = await supabase.from("prompts").insert({
        id,
        user_id: productionUser,
        title: prompt.title,
        category: prompt.category,
        summary: prompt.summary,
        when_to_use: prompt.when_to_use,
        sections: prompt.sections,
        is_favorite: 0,
        created_at: now,
        updated_at: now,
      });
      if (insertError) throw insertError;
      result.prompts += 1;
      result.promptIds[prompt.title] = id;
    } else {
      result.promptIds[prompt.title] = existing.id;
      if (
        existing.summary !== prompt.summary ||
        existing.when_to_use !== prompt.when_to_use ||
        existing.sections !== prompt.sections
      ) {
        const { error: updateError } = await supabase
          .from("prompts")
          .update({
            summary: prompt.summary,
            when_to_use: prompt.when_to_use,
            sections: prompt.sections,
            updated_at: now,
          })
          .eq("id", existing.id)
          .eq("user_id", productionUser);
        if (updateError) throw updateError;
        result.promptUpdates += 1;
      } else result.promptSkips += 1;
    }
  }
  return result;
}

console.log({ local: importLocal(), production: await importProduction() });
