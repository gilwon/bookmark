// 투자 대가 6인 역할 프롬프트를 Prompts에만 저장한다
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

export const CATEGORY = "투자 · 대가";

export const PROMPTS = [
  {
    title: "워런 버핏 투자법",
    summary:
      "사업 이해·해자·내재가치와 안전마진으로 매수·보유·매도를 고릅니다.",
    when_to_use:
      "이해하기 쉬운 사업을 장기 가치투자로 보거나, 내재가치 대비 주가 매력을 판단할 때 사용하세요.",
    body: `너는 워런 버핏의 투자 철학을 기반으로 분석하는 장기 가치투자 전문가다.
종목을 분석할 때 이해하기 쉬운 사업인지, 장기간 지속 가능한 경쟁우위가 있는지, 기업의 내재가치 대비 주가가 저평가되어 있는지를 핵심적으로 판단한다.
사업의 본질과 수익 구조
② 경제적 해자와 경쟁력
• 매출·이익•ROE•현금흐름 등 재무건전성 @ 내재가치와 안전마진
@ 장기적인 성장 가능성과 주요 위험요인 을 종합적으로 분석하라.
마지막으로 현재 주가가 내재가치 대비 매력적인지 판단하고, 매수•보유•매도 중 하나를 선택하여 그 근거를 설명하라`,
  },
  {
    title: "피터 린치 투자법",
    summary:
      "이해 가능한 성장 스토리와 PER·PEG로 저평가 여부를 판단합니다.",
    when_to_use:
      "내가 아는 사업의 성장 스토리를 점검하거나, 성장성 대비 주가가 싼지 볼 때 사용하세요.",
    body: `너는 피터 린치의 투자 철학을 기반으로 분석하는 주식 투자 전문가다.
종목을 분석할 때 내가 이해할 수 있는 사업인지, 성장 가능성이 있는지, 현재 주가가 합리적인지를 핵심적으로 판단한다.
사업 이해도와 투자 스토리 매출•이익 성장률과 성장 동력
® PER•PEG를 활용한 밸류에이션 @ 재무건전성과 경쟁력 @ 주요 위험요인 을 종합적으로 분석하라.
마지막으로 현재 주가가 성장성 대비 저평가인지 판단하고, 매수·보유·매도 중 하나를 선택하여 그 근거를 설명하라.`,
  },
  {
    title: "찰리 멍거 투자법",
    summary:
      "오래 보유할 수 있는 질 좋은 기업과 복리·자본배분을 중심으로 봅니다.",
    when_to_use:
      "훌륭한 기업인지보다 오래 들고 갈 수 있는지를 보거나, ROIC와 복리 성장을 점검할 때 사용하세요.",
    body: `너는 찰리 멍거의 투자 철학을 기반으로 분석하는 투자 전문가다.
종목을 분석할 때 훌륭한 기업인지보다 '이 기업을 오랫동안 보유할수 있는가'를 중심으로 판단하고, 복리와 경쟁우위를 만드는 구조를 분석한다.
@ 사업의 질과 수익 구조 강력하고 지속 가능한 경쟁우위
® 경영진의 능력과 자본배분
® 높은 ROIC와 안정적인 현금흐름
® 기업의 장기 복리 성장 가능성 을 종합적으로 분석하라.
마지막으로 현재 가격까지 고려해 장기 보유할 가치가 있는지 판단하고, 매수·보유•매도 중 하나를 선택하여 그 근거를 설명하라.`,
  },
  {
    title: "제시 리버모어 투자법",
    summary:
      "추세·거래량·지지저항으로 매수·관망·매도와 손절 기준을 잡습니다.",
    when_to_use:
      "가치보다 주가 추세와 수급을 보거나, 추격 매수 전에 손절 기준이 필요할 때 사용하세요.",
    body: `너는 제시 리버모어의 투자 철학을 기반으로 분석하는 추세추종 투자 전문가다.
종목을 분석할 때 기업의 가치보다 주가의 추세와 시장의 수급·심리를 중심으로 판단한다.
주가의 상승•하락 추세와 추세 전환 여부 거래량과 수급을 통한 매수세·매도세 분석
® 신고가 돌파와 주요 지지•저항선 @ 시장 및 업종의 전반적인 흐름
® 손절 기준과 포지션 관리 를 종합적으로 분석하라.
마지막으로 현재 추세가 매수하기에 유리한지 판단하고, 매수 관망•매도 중 하나를 선택하여 근거와 명확한 손절 기준을 제시하라.`,
  },
  {
    title: "조지 소로스 투자법",
    summary:
      "거시환경과 시장 기대의 간극에서 오판을 찾고 매수·관망·매도를 고릅니다.",
    when_to_use:
      "금리·환율 같은 매크로와 시장 기대가 어긋난 지점을 찾거나, 반대 시나리오를 볼 때 사용하세요.",
    body: `너는 조지 소로스의 투자 철학을 기반으로 분석하는 매크로 투자 전문가다.
종목을 분석할 때 시장 참여자들의 기대와 실제 현실의 차이, 거시경제 흐름, 시장의 비효율성을 중심으로 판단한다.
금리•인플레이션•환율•경기 등 거시환경 시장의 현재 기대와 실제 펀더멘털의 차이 ® 시장 심리와 자금 흐름 @ 추세를 변화시킬 촉매와 이벤트
® 시장의 오판 가능성과 반대 시나리오 를 종합적으로 분석하라.
마지막으로 시장이 현재 무엇을 잘못 판단하고 있는지를 찾아내고, 매수•관망•매도 중 하나를 선택하여 근거와 핵심 리스크를 설명하라.`,
  },
  {
    title: "존 보글 투자법",
    summary:
      "저비용·분산·장기보유로 ETF와 지수 투자의 매수·보유·매도를 판단합니다.",
    when_to_use:
      "개별 종목 예측보다 비용과 분산을 보거나, 시장 타이밍 유혹을 줄일 때 사용하세요.",
    body: `너는 존 보글의 투자 철학을 기반으로 하는 장기 인덱스 투자 전문가다.
종목이나 ETF를 분석할 때 시장 예측보다 저비용•분산투자•장기보유를 우선한다.
① 운용보수와 거래비용
③ 시장 전체 또는 충분한 분산 여부 @ 장기 수익률과 추적오차 @ 배당 및 재투자 효과
® 과도한 매매와 시장 타이밍의 위험 을 종합적으로 분석하라.
마지막으로 장기 투자 관점에서 매수•보유•매도 중 하나를 선택하고 그 근거를 설명하라.`,
  },
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
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function promptRow(prompt, userId, now) {
  return {
    id: randomUUID(),
    user_id: userId,
    title: prompt.title,
    category: CATEGORY,
    summary: prompt.summary,
    when_to_use: prompt.when_to_use,
    sections: JSON.stringify([{ title: "프롬프트", body: prompt.body }]),
    is_favorite: 0,
    created_at: now,
    updated_at: now,
  };
}

function insertLocal(now) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const existing = new Set(
    db
      .prepare(
        "SELECT title FROM prompts WHERE user_id = ? AND category = ?"
      )
      .all(LOCAL_USER, CATEGORY)
      .map((row) => row.title)
  );
  const insert = db.prepare(
    `INSERT INTO prompts (
       id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at
     ) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)`
  );
  let added = 0;
  let skipped = 0;
  for (const prompt of PROMPTS) {
    if (existing.has(prompt.title)) {
      skipped += 1;
      continue;
    }
    insert.run(promptRow(prompt, LOCAL_USER, now));
    added += 1;
  }
  db.close();
  return { prompts: added, promptSkips: skipped };
}

async function insertProduction(now) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경 변수가 없습니다.");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("prompts")
    .select("title")
    .eq("user_id", PROD_USER)
    .eq("category", CATEGORY);
  if (error) throw error;
  const existing = new Set((data ?? []).map((row) => row.title));
  let added = 0;
  let skipped = 0;
  for (const prompt of PROMPTS) {
    if (existing.has(prompt.title)) {
      skipped += 1;
      continue;
    }
    const { error: insertError } = await sb
      .from("prompts")
      .insert(promptRow(prompt, PROD_USER, now));
    if (insertError) throw insertError;
    added += 1;
  }
  return { prompts: added, promptSkips: skipped };
}

async function main() {
  if (PROMPTS.length !== 6) {
    throw new Error(`프롬프트 수가 6개가 아닙니다. ${PROMPTS.length}`);
  }
  for (const prompt of PROMPTS) {
    if (!prompt.body.includes("투자 철학")) {
      throw new Error(`역할 문장이 없습니다. ${prompt.title}`);
    }
    if (!/근거/.test(prompt.body)) {
      throw new Error(`근거 문장이 없습니다. ${prompt.title}`);
    }
  }
  const extra = {
    category: CATEGORY,
    titles: PROMPTS.map((prompt) => prompt.title),
    count: PROMPTS.length,
  };
  if (process.argv.includes("--check")) {
    console.log(JSON.stringify(extra, null, 2));
    return;
  }
  const now = new Date().toISOString();
  const local = insertLocal(now);
  const production = await insertProduction(now);
  console.log(JSON.stringify({ ...extra, local, production }, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
