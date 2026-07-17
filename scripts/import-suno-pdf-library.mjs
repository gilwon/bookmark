// Suno PDF 전문을 Pages에, 재사용 프롬프트를 Prompts에 저장한다
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const downloads = "/Users/gilwon/Downloads";
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^(["'])|(["'])$/g, "");
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const CATEGORY = "AI 음악 · Suno";
const now = new Date().toISOString();

const pdfs = [
  ["Suno 보컬 치트키", "Suno 보컬 치트키.pdf"],
  ["Suno 인트로 치트키 가이드북", "Suno 인트로 치트키.pdf"],
  ["AI 음악 프롬프트 사운드 단어 100개", "AI 음악 프롬프트 사운드 단어 100개 (무료 PDF) - 뮤잇.pdf"],
  ["수노 보컬 EQ, 이것만 해도 퀄리티가 달라집니다", "Suno 곡 생성 이후, 이것만 해도 퀄리티가 달라집니다 - 뮤잇.pdf"],
];

function pdfToPage(title, filename) {
  const path = resolve(downloads, filename);
  if (!existsSync(path)) throw new Error(`PDF를 찾을 수 없습니다. ${path}`);
  const text = execFileSync("pdftotext", ["-layout", path, "-"], {
    encoding: "utf8",
  })
    .replace(/\f/g, "\n\n---\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const textNode = (value) => ({ type: "text", text: value });
  const paragraph = (value) => ({
    type: "paragraph",
    content: value ? [textNode(value)] : undefined,
  });
  const content = [
    { type: "heading", attrs: { level: 1 }, content: [textNode(title)] },
    {
      type: "blockquote",
      content: [paragraph(`원본 PDF. ${filename}`)],
    },
    { type: "heading", attrs: { level: 2 }, content: [textNode("전체 내용")] },
    ...text.split(/\n{2,}/).flatMap((block) =>
      block.trim() === "---"
        ? [{ type: "horizontalRule" }]
        : [paragraph(block.replace(/\n/g, " "))]
    ),
  ];
  return { title, content: JSON.stringify({ type: "doc", content }) };
}

const promptRows = [
  {
    title: "Suno 보컬 디렉팅 치트키",
    summary: "성별·톤·음역·마이크 거리·보컬 패턴·언어를 조합해 Suno 보컬을 구체적으로 지시합니다.",
    when_to_use: "Suno에서 원하는 보컬 캐릭터와 녹음 질감을 더 정확히 만들고 싶을 때 사용하세요.",
    body: `Suno [Style of Music]에 아래 요소를 조합해 입력하세요.\n\n[성별 / 톤 / 음역], [마이크 거리 / 녹음 질감], [보컬 패턴], [언어]\n\n예시.\n- a female lead vocal, breathy soprano with a soft and clear delivery\n- a gritty, gospel-tinged male tenor lead\n- an emotive male singer\n- soft, breathy female vocals with intimacy\n- breathy female lead recorded with extreme proximity to the mic, dry and intimate\n- laid-back, whispery phrasing\n- fast-paced rhythmic vocal delivery\n- backing vocals echoing key words\n- intimate murmuring tone\n- Korean female vocal with breathy delivery\n\n활용 키워드.\n- female lead vocal, male tenor, breathy soprano, clear high soprano range, rich gravelly voice, soulful voice, breathy delivery\n- extreme proximity to the mic, dry without reverb, processed via heavy compression, intimate live room feel, stadium-sized reverb, minimal reverb\n- fast-paced vocal pattern, laid-back groove, backing vocals repeating words, layered styles together\n- singing Portuguese lyrics, the lyrics are in French, English vocal`,
  },
  {
    title: "Suno 인트로 즉시 진입 치트키",
    summary: "보컬·그루브·시그니처 사운드로 곡 시작을 즉시 잡아주는 Suno 인트로 프롬프트입니다.",
    when_to_use: "긴 빌드업 대신 첫 0~2초에 청자의 이탈을 막는 인트로를 만들 때 사용하세요.",
    body: `Suno [Style of Music]에 원하는 시작 방식을 그대로 붙여넣으세요.\n\n- 보컬 선입. Cold open with dry vocal / No long intro\n- 그루브 선입. Drop immediately into groove / No intro buildup\n- 시그니처 사운드. Open with a single signature sound / Immediate mood definition\n\n바로 쓸 수 있는 예시.\n- cold open with dry vocal, no intro, immediate engagement\n- start with impact sound, no buildup, instant hook\n- instant hook, no intro, immediate groove`,
  },
  {
    title: "Suno 장르별 인트로 프롬프트",
    summary: "힙합·팝·아프로비츠·R&B·EDM에 맞춘 즉시 진입형 인트로 프롬프트입니다.",
    when_to_use: "장르의 정체성이 첫 소리부터 드러나는 Suno 인트로를 만들 때 사용하세요.",
    body: `- Hip-hop. Open with a hard 808 hit and dry rap vocal, no intro\n- Pop. Start with dry vocal hook and minimal pluck, no buildup\n- Afrobeats. Immediate afro groove with percussion and guitar loop, no intro\n- R&B. Open with Rhodes chord and vocal chop, intimate and dry\n- EDM. Drop straight into kick and bass groove, no intro buildup`,
  },
  {
    title: "AI 음악 프롬프트 3단계 조합법",
    summary: "장르·무드·악기와 질감을 순서대로 조합해 AI 음악 프롬프트를 만드는 기본 템플릿입니다.",
    when_to_use: "Suno 프롬프트를 처음 작성하거나 장르명만 넣은 결과를 구체화할 때 사용하세요.",
    body: `아래 순서로 한 문장 프롬프트를 만드세요.\n\n[시대·장르] + [무드] + [악기·질감·리듬]\n\n장르 예시.\n- Early 2000s glossy pop\n- 1970s Motown soul\n- Dreamy late-night R&B\n- Intimate Brazilian Bossa Nova\n- Alternative rock\n- Nocturnal synth-pop\n- Rainy city pop ballad\n\n무드 예시.\n- warm, intimate, wistful, airy, cinematic, melancholic, nocturnal, romantic tension, dreamy, gritty\n\n악기·질감 예시.\n- warm analog tape tone, vintage organ harmonic bed, tight tambourine groove, soft electric piano chords, low-passed drums, gated reverb snare, cinematic pads, nylon-string guitar, warm bass swells, subtle chime textures\n\n완성 예시.\n- An intimate, sophisticated Brazilian Bossa Nova track with warm analog tape tone, soft electric piano chords, and a tight tambourine groove.`,
  },
].map((row) => ({
  id: randomUUID(),
  user_id: LOCAL_USER,
  category: CATEGORY,
  sections: JSON.stringify([{ title: "프롬프트", body: row.body }]),
  is_favorite: 0,
  created_at: now,
  updated_at: now,
  ...row,
}));

const pages = pdfs.map(([title, filename]) => pdfToPage(title, filename));
const db = new Database(resolve(root, "data/mymark.db"));
const findPage = db.prepare("SELECT id FROM custom_pages WHERE user_id = ? AND title = ?");
const findPrompt = db.prepare("SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)");
let localPages = 0;
let localPrompts = 0;
for (const page of pages) if (!findPage.get(LOCAL_USER, page.title)) { insertPage.run(randomUUID(), LOCAL_USER, page.title, page.content, now, now); localPages++; }
for (const prompt of promptRows) if (!findPrompt.get(LOCAL_USER, prompt.title, CATEGORY)) { insertPrompt.run(prompt); localPrompts++; }
db.close();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let prodPages = 0;
let prodPrompts = 0;
for (const page of pages) {
  const { data, error } = await sb.from("custom_pages").select("id").eq("user_id", PROD_USER).eq("title", page.title);
  if (error) throw error;
  if (!data?.length) { const { error: insertError } = await sb.from("custom_pages").insert({ id: randomUUID(), user_id: PROD_USER, ...page, created_at: now, updated_at: now }); if (insertError) throw insertError; prodPages++; }
}
for (const prompt of promptRows) {
  const { data, error } = await sb.from("prompts").select("id").eq("user_id", PROD_USER).eq("title", prompt.title).eq("category", CATEGORY);
  if (error) throw error;
  if (!data?.length) {
    const { body, ...row } = prompt;
    const { error: insertError } = await sb.from("prompts").insert({ ...row, id: randomUUID(), user_id: PROD_USER });
    if (insertError) throw insertError;
    prodPrompts++;
  }
}

console.log({ localPages, localPrompts, prodPages, prodPrompts });
