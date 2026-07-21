// AI Native PDF 14건의 전문과 재사용 지시문을 번호순으로 저장한다
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { basename, dirname, resolve } from "path";
import { existsSync, readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const downloads = "/Users/gilwon/Downloads";
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(\"|')|(\"|')$/g, "");
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const baseTime = Date.now();

const documents = [
  ["1-01", "지금 AI는 몇 단계인가 · 시국 브리핑"],
  ["1-02", "AI 2027 완전 해설 · 그 시나리오가 말한 것, 빗나간 것, 남는 것"],
  ["1-03", "Be AI-Native · 관광객으로 남을 것인가"],
  ["1-04", "자료만 쌓는 사람 vs 결과물 내는 사람"],
  ["1-05", "글을 왜 잘 써야 하는가 · AI 시대 최후의 스킬"],
  ["1-06", "AI 지시문 해부학 · 같은 일, 다른 결과"],
  ["1-07", "검증의 기술 · 완료했습니다를 믿지 않는 사람들"],
  ["1-08", "나 설명서 2.0 · 완성본 두 벌"],
  ["1-09", "거절과 어려운 대화 대본집 · 상황 10개"],
  ["1-10", "문의 답장, AI가 내 말투로 대신 쓰게"],
  ["1-11", "녹음만 하세요, 회의록은 AI가"],
  ["1-12", "짜지 않고 시킨다 · 바이브코딩 플레이북"],
  ["1-13", "AI 수익화의 현실 지도"],
  ["1-14", "30일 AI-Native 전환 플랜"],
].map(([number, name], index) => {
  const filename = readdirSync(downloads).find((entry) => entry.startsWith(`${number}.`) && entry.endsWith(".pdf"));
  if (!filename) throw new Error(`${number} PDF를 찾지 못했습니다.`);
  return {
    number,
    name,
    title: `${number}. ${name}`,
    path: resolve(downloads, filename),
    createdAt: new Date(baseTime - index * 1000).toISOString(),
  };
});

function extractPdf(path) {
  return execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8" });
}

const extracted = new Map(documents.map((document) => [document.number, extractPdf(document.path)]));

function textNode(text) {
  return { type: "text", text };
}

function paragraph(text) {
  return { type: "paragraph", content: text ? [textNode(text)] : undefined };
}

function pageContent(document) {
  const pdfPages = extracted.get(document.number).split("\f").map((page) => page.trim()).filter(Boolean);
  const content = [
    { type: "heading", attrs: { level: 1 }, content: [textNode(document.title)] },
    { type: "blockquote", content: [paragraph(`원본 PDF. ${basename(document.path).normalize("NFC")}`)] },
  ];
  for (const [index, pdfPage] of pdfPages.entries()) {
    content.push({ type: "heading", attrs: { level: 2 }, content: [textNode(`${index + 1}쪽`)] });
    for (const block of pdfPage.split(/\n\s*\n/)) {
      const text = block.split("\n").map((line) => line.trim()).filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
      if (text) content.push(paragraph(text));
    }
    if (index < pdfPages.length - 1) content.push({ type: "horizontalRule" });
  }
  return JSON.stringify({ type: "doc", content });
}

function linesBetween(number, start, end, occurrence = 0) {
  const lines = extracted.get(number).split("\n").map((line) => line.replace(/\f/g, "").trim());
  const startIndex = lines.reduce((indexes, line, index) => line.includes(start) ? [...indexes, index] : indexes, [])[occurrence] ?? -1;
  const endIndex = lines.findIndex((line, index) => index > startIndex && line.includes(end));
  if (startIndex < 0 || endIndex < 0) throw new Error(`${number}에서 '${start}' 블록을 찾지 못했습니다.`);
  return lines.slice(startIndex, endIndex).filter(Boolean).join(" ")
    .replace(/\s+([·•]\s*)/g, "\n$1")
    .replace(/\s+(-\s+)/g, "\n- ")
    .replace(/\s+(\[[^\]]+\])/g, "\n\n$1")
    .replace(/\s+(#{1,3}\s+)/g, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sourcePrompt(number, title, summary, start, end, when = "해당 업무를 AI에 맡길 때 원문의 빈칸과 예시를 내 상황으로 바꿔 사용하세요.", occurrence = 0) {
  return { number, title: `${number}. ${title}`, summary, when, body: linesBetween(number, start, end, occurrence) };
}

const prompts = [
  sourcePrompt("1-05", "팀 워크숍 안내문 작성", "대상·일시·장소·목적·준비물과 회신 방법을 넣어 바로 보낼 워크숍 안내문을 만듭니다.", "다음 주 팀 워크숍 안내문을 써줘.", "결과 차이"),
  sourcePrompt("1-05", "되묻는 독자로 글의 빈틈 찾기", "AI가 글을 대신 고치지 않고 독자의 질문만 뽑아 사고의 빈틈을 찾습니다.", "이 글을 처음 읽는 우리 팀장이라고 생각하고 읽어줘.", "돌아온 질문"),
  sourcePrompt("1-05", "글의 핵심 주장 역추출", "작성한 글에서 실제로 읽히는 핵심 주장을 한 문장으로 확인합니다.", "이 글을 읽고, 글쓴이의 핵심 주장이 뭐로 읽히는지", "돌아온 문장"),

  sourcePrompt("1-06", "일일 업무 보고 메일", "실제 업무와 수치를 바탕으로 팀장이 30초 안에 읽을 일일 보고를 작성합니다.", "팀장에게 보낼 일일 업무 보고 메일을 써줘.", "결과 차이"),
  sourcePrompt("1-06", "회의 메모를 실행형 회의록으로", "난잡한 회의 메모를 결정사항·액션아이템·다음 안건으로 구조화합니다.", "아래 회의 메모를 팀 공유용 회의록으로 정리해줘.", "결과 차이"),
  sourcePrompt("1-06", "주문 데이터 전처리", "날짜·빈칸·중복 규칙을 지키며 주문 데이터를 검증 가능한 표로 정리합니다.", "아래 주문 데이터를 정리하는 규칙을 알려주고", "결과 차이"),
  sourcePrompt("1-06", "시장조사 리포트 임원 요약", "긴 리포트를 결론·숫자 근거·리스크 중심의 임원용 한 장으로 압축합니다.", "아래 시장조사 리포트를 임원 보고용 한 장 요약으로 만들어줘.", "결과 차이"),
  sourcePrompt("1-06", "프로젝트 킥오프 발표 개요", "유관부서가 협조사항까지 이해하도록 10분 발표의 메시지 흐름을 설계합니다.", "신규 프로젝트 킥오프 발표 개요를 슬라이드 목차로 짜줘.", "결과 차이"),
  sourcePrompt("1-06", "신메뉴 인스타 캡션", "가게의 실제 톤·상품 정보·금지 표현을 반영한 신메뉴 캡션을 만듭니다.", "수제 디저트 신메뉴 인스타 캡션을 써줘.", "결과 차이"),
  sourcePrompt("1-06", "인테리어 견적 문의 답장", "확정 금액을 단정하지 않고 현장 방문 상담으로 이어지는 견적 답장을 만듭니다.", "아래 인테리어 견적 문의에 답장 메일을 써줘.", "결과 차이"),
  sourcePrompt("1-06", "원두 구독 상세페이지", "구독 부담을 낮추고 상품 강점을 고객 효익으로 번역한 상세페이지 초안을 만듭니다.", "원두 정기구독 상품 상세페이지 초안을 써줘.", "결과 차이"),
  sourcePrompt("1-06", "불만 리뷰 공개 답글", "불만 고객과 잠재 고객을 함께 고려한 짧고 구체적인 공개 답글을 작성합니다.", "아래 별 2개 리뷰에 공개 답글을 써줘.", "결과 차이"),
  sourcePrompt("1-06", "외주 계약서 위험 조항 점검", "수주자에게 불리한 조항과 협상 요청안을 표로 찾되 법률 자문으로 단정하지 않습니다.", "아래 외주 개발 계약서에서 나(수주자)에게 불리한 조항을 찾아줘.", "결과 차이", "외주 계약서의 위험 신호를 1차로 정리한 뒤 변호사 검토가 필요한 지점을 찾을 때 사용하세요."),
  sourcePrompt("1-06", "좋은 지시 5요소 빈칸 틀", "맥락·목적·재료·형식·금지를 빠뜨리지 않게 만드는 범용 AI 지시문 틀입니다.", "무엇을 만들지: 보고서 / 답장 / 요약 / 캡션 등", "한번더"),

  sourcePrompt("1-07", "글의 통계·출처 검증", "글 속 숫자·통계·인용·연구의 실제 출처와 생성 여부를 구분합니다.", "방금 쓴 글에서 숫자·통계·인용·연구를 전부 목록으로 뽑아줘.", "해부 · 핵심"),
  sourcePrompt("1-07", "요약 원문 대조표", "요약의 각 문장을 근거가 된 원문과 나란히 대조해 왜곡을 찾습니다.", "이 요약의 각 줄이 원문 어느 문장에서 나왔는지", "해부 · 핵심"),
  sourcePrompt("1-07", "분기 합계 검산", "분기 합계와 증감률의 중간 계산을 펼쳐 빠진 값과 오류를 확인합니다.", "방금 낸 분기 합계를 검산해줘.", "해부 · 핵심"),
  sourcePrompt("1-07", "파일 정리 스크립트 안전 점검", "삭제·덮어쓰기·이동 위험을 찾고 복사본과 미리보기부터 실행하도록 코드를 바꿉니다.", "이 스크립트를 실행하기 전에 점검해줘.", "해부 · 핵심"),
  sourcePrompt("1-07", "의사결정 반대편 레드팀", "AI의 추천과 반대되는 안을 강하게 변호시켜 놓친 위험과 조건을 찾습니다.", "방금 넌 A안을 추천했어.", "해부 · 핵심"),
  sourcePrompt("1-07", "근거 실토", "AI 답변의 근거 있는 사실·미확인 정보·생성된 내용을 분리합니다.", "방금 답에서 사실·숫자·인용·출처를 전부 목록으로 뽑아줘.", "글·요약·조사 결과에"),
  sourcePrompt("1-07", "자기 반증", "AI가 자기 답의 취약점과 실패 조건을 직접 공격하게 합니다.", "네 답이 틀렸다고 가정하고 스스로 공격해봐.", "의사결정·추천·전략에"),
  sourcePrompt("1-07", "실행 강제", "코드·계산의 실제 실행 여부와 중간값, 손상 가능성을 확인합니다.", "이 코드·계산을 실제로 실행하면 어떤 결과가 나오는지", "코드·자동화·데이터 계산에"),

  sourcePrompt("1-08", "마케팅팀 대리 나 설명서", "보고·캠페인·카피·회의록 업무에 맞춘 마케팅팀 대리용 상주 지침입니다.", "#   나에 대한 설명 (AI가 답하기 전에 늘 참고할 것)", "이게 왜 완성본인가"),
  sourcePrompt("1-08", "온라인 클래스 운영자 나 설명서", "모집·문의·복습 자료·리뷰 응대에 맞춘 1인 클래스 운영자용 상주 지침입니다.", "#   나에 대한 설명 (AI가 답하기 전에 늘 참고할 것)", "A와 B의 차이를 보세요", undefined, 1),
  sourcePrompt("1-08", "나 설명서 6블록 빈칸 틀", "직업·업무·톤·금지·판단·질문 규칙을 채워 나만의 AI 상주 지침을 만듭니다.", "#   나에 대한 설명 (AI가 답하기 전에 늘 참고할 것)", "3 5분 실제로 한 번 시켜보고 고친다", undefined, 2),
  sourcePrompt("1-08", "프리랜서 영상 편집자 나 설명서", "견적·진행 공유·수정 범위 협의에 맞춘 영상 편집자용 상주 지침입니다.", "#   나에 대한 설명 (AI가 답하기 전에 늘 참고할 것)", "보이시죠", undefined, 3),

  sourcePrompt("1-09", "연봉 협상 AI 리허설", "방어적인 팀장 역할과 3턴 대화를 연습하고 흔들린 지점을 피드백받습니다.", "지금부터 너는 내 직장 상사 역할이야.", "왜 이렇게"),
  sourcePrompt("1-09", "환불 고객 AI 리허설", "화난 환불 고객의 압박을 5턴 동안 연습하고 감정과 규정 대응을 점검합니다.", "이번엔 난이도를 올릴게.", "왜 이렇게"),
  sourcePrompt("1-09", "내 말투 어려운 대화 대본 생성", "관계·레드라인·목표를 반영해 어려운 대화 대본을 세 가지 강도로 만듭니다.", "내 상황: 무리한 부탁 거절 / 가격 통보 / 반대 의견 등", "눈금 맞추는 법"),

  {
    number: "1-10",
    title: "1-10. 문의 답장 스와이프 파일 생성",
    summary: "실제 답장 예시와 톤 규칙을 학습해 문의 유형별 기본 답변 모음을 만듭니다.",
    when: "자주 오는 고객 문의에 내 말투로 빠르게 답할 기본 답변 창고를 만들 때 사용하세요.",
    body: `아래 실제 답장 3개에서 내 말투를 학습해줘.\n\n[내가 실제로 쓴 좋은 답장 3개]\n1. [답장]\n2. [답장]\n3. [답장]\n\n[톤 규칙]\n- [정중함·간결함·이모지 사용 여부 등]\n\n[절대 하지 말 것]\n- [확답 금지·과한 사과 금지·가격 먼저 말하지 않기 등]\n\n위 톤으로 가격, 일정·납기, 환불, 재고·재입고, 불만·사과, 협업 제안, 수정 요청, 결제, 배송, 기타 문의의 기본 답변을 각각 만들어줘.`,
  },
  {
    number: "1-11",
    title: "1-11. 녹취에서 회의록과 할 일 추출",
    summary: "녹취에서 결정사항·할 일·미정 항목을 같은 형식으로 뽑고 숫자와 기한을 보존합니다.",
    when: "팀 회의·고객 미팅·강의·인터뷰 녹취를 실행 가능한 회의록으로 바꿀 때 사용하세요.",
    body: `아래 회의 녹취를 회의록과 할 일 목록으로 정리해줘.\n\n[뽑을 것]\n- 결정사항\n- 할 일\n- 아직 정해지지 않은 것(미정)\n\n[형식]\n- 제목\n- 날짜\n- 참석자\n- 항목별 정리\n- 할 일은 담당자·기한을 표시하고, 녹취에 없으면 미정으로 남길 것\n\n[유지할 것]\n- 누가 한 말인지 보존\n- 숫자·기한 같은 근거를 바꾸지 말 것\n- 없는 내용을 지어내지 말 것\n\n[회의 녹취 붙여넣기]`,
  },

  sourcePrompt("1-14", "쇼핑몰 고객 문의 답장 위임", "쇼핑몰 규정·톤·금지를 반영해 검토 후 바로 보낼 고객 문의 답장을 만듭니다.", "우리 쇼핑몰 고객 문의에 보낼 답장 초안을 써줘.", "여기서 읽을 것"),
  sourcePrompt("1-14", "쇼핑몰 미니 나 설명서", "쇼핑몰의 고객·톤·업무·규정·검토 원칙을 모든 대화 앞에 붙이는 지침입니다.", "#   나는 이런 사람입니다 (지시할 때 맨 앞에 붙이세요)", "여기서 읽을 것"),
  sourcePrompt("1-14", "쇼핑몰 CS 담당 AI 직원", "문의 분류와 답장 초안을 전담하되 환불·보상 판단은 사람에게 넘기는 CS 역할 지침입니다.", "너는 우리 쇼핑몰의 CS 담당자야.", "여기서 읽을 것"),
].map((prompt, index) => ({ ...prompt, category: `AI Native · ${prompt.number}`, createdAt: new Date(baseTime - index * 1000).toISOString() }));

const pages = documents.map((document) => ({ ...document, content: pageContent(document) }));
if (pages.length !== 14 || prompts.length !== 34 || new Set(prompts.map((prompt) => prompt.title)).size !== prompts.length) {
  throw new Error("Page 또는 Prompt 개수와 중복 검증에 실패했습니다.");
}
const pageStats = pages.map((page) => ({ number: page.number, chars: extracted.get(page.number).replace(/\s/g, "").length }));
const invalidPages = pageStats.filter(({ chars }) => chars < 1_000);
const invalidPrompts = prompts.filter(({ body }) => body.length < 50).map(({ title, body }) => ({ title, chars: body.length }));
if (invalidPages.length || invalidPrompts.length) {
  throw new Error(`PDF 전문 또는 Prompt 본문이 불완전합니다. ${JSON.stringify({ invalidPages, invalidPrompts })}`);
}
if (process.argv.includes("--check")) {
  console.log({ pages: pages.length, prompts: prompts.length, pageStats, promptsBySource: Object.fromEntries(documents.map(({ number }) => [number, prompts.filter((prompt) => prompt.number === number).length])) });
  process.exit(0);
}

function sections(prompt, pageId) {
  return JSON.stringify([
    { title: "프롬프트", body: prompt.body },
    { title: "관련 Page", body: `/pages/${pageId}` },
    { title: "원본 PDF", body: basename(documents.find((document) => document.number === prompt.number).path).normalize("NFC") },
  ]);
}

const db = new Database(resolve(root, "data/mymark.db"));
const findLocalPage = db.prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND title = ?");
const insertLocalPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
const updateLocalPage = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
const findLocalPrompt = db.prepare("SELECT id, summary, when_to_use, sections FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insertLocalPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
const updateLocalPrompt = db.prepare("UPDATE prompts SET summary = ?, when_to_use = ?, sections = ?, updated_at = ? WHERE id = ? AND user_id = ?");
const localPageIds = new Map();
let localPages = 0;
let localPageUpdates = 0;
let localPrompts = 0;
let localPromptUpdates = 0;
db.transaction(() => {
  for (const page of pages) {
    const existing = findLocalPage.get(LOCAL_USER, page.title);
    const id = existing?.id ?? randomUUID();
    localPageIds.set(page.number, id);
    if (!existing) {
      insertLocalPage.run(id, LOCAL_USER, page.title, page.content, page.createdAt, page.createdAt);
      localPages += 1;
    } else if (existing.content !== page.content) {
      updateLocalPage.run(page.content, new Date().toISOString(), id, LOCAL_USER);
      localPageUpdates += 1;
    }
  }
  for (const prompt of prompts) {
    const promptSections = sections(prompt, localPageIds.get(prompt.number));
    const existing = findLocalPrompt.get(LOCAL_USER, prompt.title, prompt.category);
    if (!existing) {
      insertLocalPrompt.run(randomUUID(), LOCAL_USER, prompt.title, prompt.category, prompt.summary, prompt.when, promptSections, prompt.createdAt, prompt.createdAt);
      localPrompts += 1;
    } else if (existing.summary !== prompt.summary || existing.when_to_use !== prompt.when || existing.sections !== promptSections) {
      updateLocalPrompt.run(prompt.summary, prompt.when, promptSections, new Date().toISOString(), existing.id, LOCAL_USER);
      localPromptUpdates += 1;
    }
  }
})();
db.close();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase 운영 환경변수가 없습니다.");
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: existingProdPages, error: prodPageLookupError } = await supabase.from("custom_pages").select("id, title, content").eq("user_id", PROD_USER).in("title", pages.map((page) => page.title));
if (prodPageLookupError) throw prodPageLookupError;
const prodPageMap = new Map((existingProdPages ?? []).map((page) => [page.title, page]));
const prodPageIds = new Map();
const newProdPages = [];
const changedProdPages = [];
for (const page of pages) {
  const existing = prodPageMap.get(page.title);
  const id = existing?.id ?? randomUUID();
  prodPageIds.set(page.number, id);
  if (!existing) newProdPages.push({ id, user_id: PROD_USER, title: page.title, content: page.content, created_at: page.createdAt, updated_at: page.createdAt });
  else if (existing.content !== page.content) changedProdPages.push({ id, content: page.content });
}
if (newProdPages.length) {
  const { error } = await supabase.from("custom_pages").insert(newProdPages);
  if (error) throw error;
}
for (const page of changedProdPages) {
  const { error } = await supabase.from("custom_pages").update({ content: page.content, updated_at: new Date().toISOString() }).eq("id", page.id).eq("user_id", PROD_USER);
  if (error) throw error;
}

const { data: existingProdPrompts, error: prodPromptLookupError } = await supabase.from("prompts").select("id, title, category, summary, when_to_use, sections").eq("user_id", PROD_USER).in("title", prompts.map((prompt) => prompt.title));
if (prodPromptLookupError) throw prodPromptLookupError;
const prodPromptMap = new Map((existingProdPrompts ?? []).map((prompt) => [`${prompt.category}\n${prompt.title}`, prompt]));
const newProdPrompts = [];
const changedProdPrompts = [];
for (const prompt of prompts) {
  const promptSections = sections(prompt, prodPageIds.get(prompt.number));
  const existing = prodPromptMap.get(`${prompt.category}\n${prompt.title}`);
  const row = { summary: prompt.summary, when_to_use: prompt.when, sections: promptSections };
  if (!existing) newProdPrompts.push({ id: randomUUID(), user_id: PROD_USER, title: prompt.title, category: prompt.category, ...row, is_favorite: 0, created_at: prompt.createdAt, updated_at: prompt.createdAt });
  else if (existing.summary !== row.summary || existing.when_to_use !== row.when_to_use || existing.sections !== row.sections) changedProdPrompts.push({ id: existing.id, ...row });
}
if (newProdPrompts.length) {
  const { error } = await supabase.from("prompts").insert(newProdPrompts);
  if (error) throw error;
}
for (const prompt of changedProdPrompts) {
  const { id, ...row } = prompt;
  const { error } = await supabase.from("prompts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", PROD_USER);
  if (error) throw error;
}

console.log({ parsedPages: pages.length, parsedPrompts: prompts.length, localPages, localPageUpdates, localPrompts, localPromptUpdates, prodPages: newProdPages.length, prodPageUpdates: changedProdPages.length, prodPrompts: newProdPrompts.length, prodPromptUpdates: changedProdPrompts.length });
