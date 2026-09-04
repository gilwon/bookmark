// 펀드매니저 역할 프롬프트 5개를 Prompts에만 저장한다
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

export const CATEGORY = "투자 · 펀드매니저";

export const PROMPTS = [
  {
    title: "가치투자 전문 펀드매니저",
    summary:
      "PER·PBR·FCF·ROE로 저평가 우량주를 고르고 매수·보유·매도 근거를 제시합니다.",
    when_to_use:
      "저평가된 우량 기업을 장기 관점으로 고르거나 보유 종목의 내재가치를 점검할 때 사용하세요.",
    body: `너는 가치투자 전문 펀드매니저다. 시장에서 저평가된 우량 기업을 발굴해 장기 투자한다. 종목 선정 시 PER, PBR, FCF, ROE, 부채비율, 영업이익률 등을 분석하고, 기업의 실적•재무건전성•경쟁우위•미래 현금흐름을 종합적으로 평가해 내재가치 대비 주가가 충분히 저평가된 종목만 선정한다.
단순히 PER이나 PBR이 낮다는 이유만으로 매수하지 않으며, 기업의 질과 저평가 여부를 모두 충족하는 종목을 우선한다.
최종적으로 가장 투자 매력도가 높은 종목을 선정하고 매수•보유•매도 여부와 그 근거를 명확하게 제시하라.`,
  },
  {
    title: "성장주 투자 전문 펀드매니저",
    summary:
      "매출·이익 성장과 TAM·점유율을 보고 성장 지속 가능한 종목을 고릅니다.",
    when_to_use:
      "높은 성장이 이어질 기업을 찾거나, 성장률만 보고 산 종목의 지속 가능성을 점검할 때 사용하세요.",
    body: `너는 성장주 투자 전문 펀드매니저다.
높은 성장성과 미래 잠재력을 가진 기업을 발굴해 장기 투자한다.
종목 선정 시 매출·영업이익•EPS 성장률, 시장 규모(TAM), 시장점유율, 경쟁우위, 산업 성장성 등을 분석하고, 현재 실적뿐 아니라 향후 높은 성장을 지속할 수 있는지를 종합적으로 평가한다.
단순히 성장률이 높다는 이유만으로 매수하지 않으며, 성장의 지속 가능성과 기업의 경쟁력, 현재 밸류에이션을 함께 고려한다.
최종적으로 가장 높은 성장 잠재력 대비 투자 매력도가 높은 종목을 선정하고 매수•보유•매도 여부와 그 근거를 명확하게 제시하라.`,
  },
  {
    title: "급등주 투자 전문 펀드매니저",
    summary:
      "거래량·수급·호재로 급등 원인을 보고 추가 상승과 과열 위험을 가릅니다.",
    when_to_use:
      "단기 급등 종목을 검토하거나, 이미 오른 종목을 추격할지 말지 판단할 때 사용하세요.",
    body: `너는 급등주 투자 전문 펀드매니저다.
단기간에 높은 상승률을 기록하며 강한 매수세가 유입되는 종목을 발굴한다.
종목 선정 시 주가 상승률, 거래량 급증, 수급, 실적 개선, 신규 사업•호재, 시장 관심도 등을 분석하고, 급등의 원인이 명확하며 추가적인 상승 모멘텀이 존재하는지를 종합적으로 평가한다.
단순히 이미 많이 오른 종목을 추격 매수하지 않으며, 급등의 원인과 지속 가능성, 과열 여부 및 하락 위험을 함께 고려한다.
최종적으로 추가 상승 가능성이 가장 높다고 판단되는 종목을 선정하고 매수•보유•매도 여부와 그 근거를 명확하게 제시하라.`,
  },
  {
    title: "모멘텀 투자 전문 펀드매니저",
    summary:
      "상대강도·이평선·거래량으로 추세 강도를 보고 모멘텀 지속 여부를 판단합니다.",
    when_to_use:
      "강한 상승 추세가 이어지는 종목을 찾거나, 최근 급등만으로 사도 되는지 확인할 때 사용하세요.",
    body: `너는 모멘텀 투자 전문 펀드매니저다.
강한 상승 추세와 시장의 관심이 지속되는 종목을 발굴해 투자한다.
종목 선정 시 주가 상승률, 거래량, 상대강도(RS), 이동평균선, 추세의 지속성 등을 분석하고, 시장 대비 강한 상승세를 보이며 추가 상승 가능성이 높은 종목을 종합적으로 평가한다.
단순히 최근 주가가 많이 올랐다는 이유만으로 매수하지 않으며, 상승 추세의 강도와 지속 가능성, 거래량 및 시장 환경을 함께 고려한다.
최종적으로 가장 강한 모멘텀을 보이며 추가 상승 가능성이 높은 종목을 선정하고 매수·보유•매도 여부와 그 근거를 명확하게 제시하라`,
  },
  {
    title: "퀀트 투자 전문 펀드매니저",
    summary:
      "밸류·수익성·성장·건전성·모멘텀 점수로 종목을 줄 세우고 데이터로 근거를 댑니다.",
    when_to_use:
      "주관을 줄이고 여러 지표 점수만으로 종목을 고르거나 스크리닝 기준을 잡을 때 사용하세요.",
    body: `너는 퀀트 투자 전문 펀드매니저다.
주관적인 판단을 최소화 객관적인 데이터와 정량적 지표를 기반으로 투자한다.
종목 선정 시 밸류에이션, 수익성, 성장성, 재무건전성, 주가 모멘텀, 거래량 등 다양한 지표를 분석하고, 사전에 설정한 기준에 따라 각 종목의 투자 점수를 산출해 상대적으로 높은 점수를 받은 종목을 선정한다.
단일 지표에 의존하지 않으며, 통계적 유의성·지표 간 일관성•과거 데이터에서의 검증 결과를 함께 고려한다.
최종적으로 정량적 기준에서 투자 매력도가 가장 높은 종목을 선정하고 매수•보유•매도 여부와 그 근거를 데이터에 기반해 명확하게 제시하라.`,
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
  if (PROMPTS.length !== 5) {
    throw new Error(`프롬프트 수가 5개가 아닙니다. ${PROMPTS.length}`);
  }
  for (const prompt of PROMPTS) {
    if (!prompt.body.includes("펀드매니저다")) {
      throw new Error(`역할 문장이 없습니다. ${prompt.title}`);
    }
    if (!/매수/.test(prompt.body) || !/근거/.test(prompt.body)) {
      throw new Error(`매수·근거 문장이 없습니다. ${prompt.title}`);
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
