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

function textToPage(title, source, text) {
  const textNode = (value) => ({ type: "text", text: value });
  const paragraph = (value) => ({
    type: "paragraph",
    content: value ? [textNode(value)] : undefined,
  });
  return {
    title,
    content: JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [textNode(title)] },
        { type: "blockquote", content: [paragraph(source)] },
        { type: "heading", attrs: { level: 2 }, content: [textNode("전체 내용")] },
        ...text.split(/\n{2,}/).map((block) => paragraph(block.replace(/\n/g, " "))),
      ],
    }),
  };
}

const metaTagPage = textToPage(
  "Suno AI 메타태그 완벽 가이드",
  "사용자 제공 원문.",
  `## 메타태그 기능과 사용 위치

[Intro] | 곡의 분위기 설정 | 곡의 맨 처음 | 초반 사운드와 분위기의 기준을 설정하는 구간.
[Verse] | 이야기 전개 | 절 구간 시작 | 가사가 계속 변하며 스토리텔링을 담당하는 구간. 비교적 단순한 멜로디 구조.
[Pre-Chorus] | 후렴 전 빌드업 | 절 끝에서 후렴 직전 | 에너지와 기대감을 높여 후렴의 임팩트를 극대화하는 연결 구간.
[Chorus] | 핵심 메시지·훅 | 반복되는 핵심 블록 위 | 반복성이 높고 멜로디가 가장 부각되는 곡의 중심. 가장 감정적이고 강렬한 구간.
[Hook] | 기억에 남는 강렬함 | 절 또는 다른 부분 중간 | 짧고 캐치한 한두 줄의 구절. 중독성 있는 비트나 멜로디로 처리.
[Bridge] | 변화와 긴장 | 후렴 후 또는 곡 후반부 | 템포·코드·분위기를 전환해 클라이맥스를 준비하고 에너지를 재상승시킴.
[Break] | 악기 대조 구간 | 곡 중반 또는 후반 | 보컬·드럼 등 일부 악기를 빼 공백감을 만들고 집중력을 다시 높임.
[Drop] | 에너지 폭발 지점 | EDM·하이에너지 곡의 절정 | 빌드업 뒤 모든 악기가 함께 터지는 최고 에너지 구간.
[Instrumental] | 보컬 없이 악기만 생성 | Intro·Break·Guitar Solo·Outro 등 | 보컬이 제거된 악기 구간. 예. [Instrumental] guitar solo.

## 기본 구조 예시

[Intro] → [Verse 1] → [Pre-Chorus] → [Chorus] → [Verse 2] → [Pre-Chorus] → [Chorus] → [Bridge] → [Chorus] → [Outro]

## 메타태그 사용 예시

[Intro]
[Instrumental] guitar solo
[Verse 1]
밤하늘 아래 너와 함께 시간이 멈춘 것 같아 너의 미소 속에 빠져 모든 게 완벽해
[Pre-Chorus]
넌 날 깨어나게 해 이 감정 부정할 수 없어
[Chorus]
우린 gold rush 속에, 황금빛 같은 날 너는 내 길이고 멈출 수 없어 우린 gold rush 속에, 살아있음을 느껴 너와 함께라면 난 충분해
[Verse 2]
너의 목소리가 음악처럼 들려 꿈속을 헤매고 있어 우릴 위한 이야기를 써 내려가 넌 전부야
[Pre-Chorus]
넌 내 영혼을 태워 매순간이 그리움
[Chorus]
우린 gold rush 속에, 황금빛 같은 날 너는 내 길이고 멈출 수 없어 우린 gold rush 속에, 살아있음을 느껴 너와 함께라면 난 충분해
[Bridge]
손을 놓지 말아 이 순간이 진짜야 영원히 함께하자
[Chorus]
우린 gold rush 속에, 황금빛 같은 날 너는 내 길이고 멈출 수 없어 우린 gold rush 속에, 살아있음을 느껴 너와 함께라면 난 충분해
[Outro] 너와 함께

## 1. 장르 Genre

Pop(팝). 대중적인 멜로디와 구조로 가장 범용적이고 귀에 잘 들어오는 음악.
K-pop(케이팝). 화려한 편곡과 아이돌 스타일 보컬, 정교한 프로덕션.
J-pop(제이팝). 밝고 애니메이션풍의 팝, 캐치한 멜로디와 독특한 악기 사용.
Latin Pop(라틴팝). 열정적 분위기와 라틴 악기, 춤추는 느낌.
Hip-hop(힙합). 비트 중심, 랩과 샘플링, 강한 리듬감.
Trap(트랩). 808 베이스·빠른 하이햇·묵직한 비트.
R&B(알앤비). 소울풀한 보컬과 부드러운 그루브, 감성적 리듬감.
Soul(소울). 가스펠·R&B·블루스가 결합된 감정 표현 중심 장르.
EDM(일렉트로닉 댄스). 전자 사운드와 드롭 중심, 클럽·댄스플로어용.
House(하우스). 4비트 기반 댄스, 반복 리듬을 강조.
Synthwave(신스웨이브). 80년대 복고 신시사이저 사운드.
Electronic(일렉트로닉). 전자 악기와 컴퓨터 기반의 실험적 사운드.
Rock(락). 기타 중심의 강한 에너지와 백비트.
Metal(메탈). 강한 디스토션 기타와 파워풀한 보컬.
Blues(블루스). 특유의 코드 진행과 애절한 보컬.
Jazz(재즈). 즉흥 연주·스윙 리듬·복잡한 화성.
Funk(펑크). 싱코페이션 베이스와 춤추기 좋은 그루브.
Reggae(레게). 자메이카 기반의 오프비트 리듬과 여유로운 흐름.
Reggaeton(레게톤). 라틴 리듬 기반의 현대적 댄스 음악.
Country(컨트리). 미국 민속 음악 기반의 어쿠스틱 악기.
Indie(인디). 감성적이고 개성 있는 독립적 사운드.
Lo-fi(로우파이). 빈티지하고 따뜻하며 느긋한 공부·휴식용 분위기.
Folk(포크). 전통 민속 음악 기반의 어쿠스틱 중심 사운드.
Classical(클래식). 격식 있는 서양 고전 음악, 웅장하고 정교한 느낌.
Ambient(앰비언트). 선율보다 질감과 분위기에 집중하는 배경음악.
Cinematic(시네마틱). 영화음악 스타일의 웅장하고 드라마틱한 사운드.
Epic(에픽). 고조되는 흐름과 장대한 드라마틱 구성.
World Music(월드뮤직). 다양한 민족 악기와 이국적 문화 융합 사운드.

## 2. 무드와 분위기

Emotional(감성적인). 슬픔·사랑·회상 표현을 강조하며 진정성 있는 보컬과 여운 있는 멜로디.
Romantic(로맨틱한). 사랑스럽고 부드럽고 따뜻한 흐름.
Sentimental(감상적인). 회상과 감정 몰입, 추억을 부르는 섬세한 보컬.
Melancholic(우울한). 쓸쓸함·외로움, 마이너 키와 낮은 음역대.
Sad(슬픈). 마이너 키·느린 템포·음울한 코드 진행.
Dark(어두운). 낮은 음역대와 무거운 코드, 불안과 긴장.
Nostalgic(향수를 불러일으키는). 과거 회상과 80~90년대 프로덕션 감각.
Mysterious(신비로운). 불규칙 리듬과 비화음으로 예측 불가능한 전개.
Dreamy(몽환적인). 리버브와 미니멀 악기로 부유하는 느낌.
Introspective(내면적인). 혼잣말 같은 느린 진행과 자기 성찰.
Calm(잔잔한). 조용하고 평온한 구성.
Chill(차분한). 느슨한 리듬과 아늑한 분위기.
Uplifting(고양되는). 상승 멜로디와 밝은 코드로 희망·긍정 에너지 전달.
Hopeful(희망적인). 메이저 키와 따뜻한 악기음.
Powerful(강력한). 풍부한 악기 배치와 강한 리듬·보컬.
Energetic(에너지 넘치는). 빠른 템포와 역동적 리듬.
Aggressive(공격적인). 거친 보컬·왜곡 기타·강한 리듬.
Groovy(리듬감 있는). 베이스 라인과 싱코페이션으로 몸을 흔들게 하는 비트.
Playful(장난스러운). 밝고 유쾌하고 경쾌한 리듬.
Dramatic(극적인). 급격한 템포·음량 변화와 클라이맥스.

### 곡 콘셉트별 추천 조합

기쁘고 신나는 곡. Uplifting, Energetic, Groovy에 Playful, Hopeful을 보조로 사용. 밝은 메이저 키·빠른 템포·긍정 가사·강한 리듬감.
감성적인 슬픈 발라드. Emotional, Sad, Melancholic에 Sentimental, Introspective를 보조로 사용. 마이너 키·느린 템포·진정성 보컬·공간감 있는 악기 배치.
차분하고 몽환적인 곡. Dreamy, Calm, Chill에 Nostalgic, Romantic을 보조로 사용. 리버브·미니멀 악기·부드러운 보컬·평온한 진행.

## 3. 악기와 사운드 요소 Instrumentation

Piano. 서정적이며 발라드·재즈에 적합.
Acoustic guitar. 따뜻한 감성의 인디·포크 느낌.
Electric guitar. 록·펑크의 강렬한 리프.
Synth bass. EDM·Trap용 저역대 전자 베이스.
808 drums. 묵직한 힙합·트랩 드럼.
Strings section. 웅장하고 감성적인 배경.
Brass section. 경쾌하고 파워풀한 느낌.
Saxophone. 재지한 무드와 감성 솔로.
Lo-fi vinyl noise. 빈티지·chill 질감.
Percussion. 라틴·펑크의 리듬감 강화.
Harp. 맑고 우아한 분위기.
Reverb-heavy pads. 몽환적이고 공간감 있는 사운드.
Vocoder / Talkbox. 미래적인 전자 보컬 효과.
Choir background. 웅장하고 신성한 무드.
Ambient textures. 배경 분위기와 몰입감 강화.
Distorted guitar. 거칠고 강한 사운드.
Steel drum. 캐리비안풍의 이국적이고 밝은 음색.
Drum machine. 일정하고 기계적인 비트.
Sampling / loops. 반복 리프와 트렌디한 구성.
Orchestra ensemble. 영화적인 스케일과 서사적 전개.

## 4. 보컬 톤과 스타일 Vocal Tone/Style

Soft female vocals. 감성 발라드·로파이·드림팝에 맞는 부드러운 여성 보컬.
Powerful female vocals. 고음·에너지·임팩트를 강조하는 여성 보컬.
Smooth female vocals. R&B·재즈에 맞는 매끄러운 여성 보컬.
Deep male voice. 안정감과 진중함을 주는 깊고 낮은 남성 보컬.
Soulful male vocals. R&B·재즈·블루스용 소울풀한 남성 보컬.
Raspy male vocals / Gritty male vocals. 록·블루스·펑크에 어울리는 거칠고 탁한 남성 보컬.
Whispered vocals. 몽환적이고 로맨틱한 속삭임.
Childlike vocals. 순수하고 이국적인 느낌.
Emotional vocal delivery. 슬픔·애틋함·호소력을 강조.
Fast rap vocals / Rapping. 힙합·트랩의 빠른 리듬감.
Spoken word style. 내레이션·시 낭송처럼 말하듯 부르기.
Breathless delivery. 긴박감과 몰입감 강화.
Crooning. 부드럽고 낮게 읊조리는 창법.
Scat. 의미 없는 음절의 재즈 즉흥 가창.
Call and Response. 주고받는 형식의 음악적 대화.
Layered vocal textures / Harmonization / Backing chorus. 풍성한 코러스·화음과 후렴 강조.
Airy vocal harmonies / Echoed background vocals. 투명하고 몽환적인 공간감.
Auto-tuned vocals. 트랩·EDM의 전자 보컬 느낌.
Minimalist vocal lines. 앰비언트·로파이의 여백.
A Cappella. 반주 없는 목소리 가창.
Falsetto. 높은 음역의 가늘고 가벼운 가성.
Belt. 고음역을 진성으로 지르는 창법.
Melisma / Vocal Run. 한 음절에 여러 음을 붙이거나 빠르게 연속 처리하는 보컬 기교.

## 5. 템포와 리듬 Tempo/Rhythm

Slow tempo. 서정적이고 감정 표현을 강조하는 발라드·감성곡.
Mid-tempo. 가장 범용적이고 자연스러운 대중음악 기본 속도.
Fast tempo. 댄스·록·힙합에 맞는 박력 있는 전개.
Upbeat. 활기차고 즐거운 밝은 분위기.
Downtempo. Lo-fi·Ambient에 맞는 침착하고 여유로운 흐름.
Laid-back rhythm. 인디·로파이에 맞는 느슨하고 아늑한 리듬.
Driving rhythm. 락·EDM·팝의 강한 추진력.
Swing groove. 재즈·펑크 특유의 유동적 리듬.
Syncopated beat. 펑크·라틴·R&B의 예상 밖 액센트.
4-on-the-floor. 하우스·EDM의 규칙적인 4비트 킥.
Hard-hitting drums. 트랩·힙합의 묵직하고 파워풀한 타격감.
Bouncy groove. 펑크·팝·댄스의 경쾌하고 흥겨운 리듬.

### BPM 가이드

60–90 BPM. 발라드·로파이·어쿠스틱. 감성적·차분함·로맨틱.
90–120 BPM. 팝·R&B·인디·소울. 자연스러움·친근함·편안함.
120–140+ BPM. 댄스·힙합·락·EDM. 에너지·활기·강렬함.`,
);

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
  {
    title: "Suno 메타태그 곡 구조 템플릿",
    summary: "인트로부터 아웃트로까지 메타태그로 곡의 전개와 에너지 변화를 지정합니다.",
    when_to_use: "Suno 가사 입력란에서 곡의 구간 구성과 클라이맥스를 명확히 지시할 때 사용하세요.",
    body: `[Intro]\n[Verse 1]\n[가사]\n[Pre-Chorus]\n[후렴 직전 가사]\n[Chorus]\n[핵심 훅 가사]\n[Verse 2]\n[가사]\n[Pre-Chorus]\n[후렴 직전 가사]\n[Chorus]\n[핵심 훅 가사]\n[Bridge]\n[분위기·코드·가사 톤을 바꾸는 가사]\n[Chorus]\n[핵심 훅 가사]\n[Outro]\n\n선택 태그.\n- [Instrumental] guitar solo\n- [Break]\n- [Drop]\n- [Hook]`,
  },
  {
    title: "Suno 글로벌 플레이리스트 작사 · 10곡 생성",
    summary: "그루비한 팝과 인디 소울 감성의 영어 플레이리스트용 가사 10곡을 연속 생성합니다.",
    when_to_use: "글로벌 청취자를 위한 4분 이상 길이의 반복 청취형 플레이리스트 가사가 필요할 때 사용하세요.",
    body: `# 역할
당신은 글로벌 플레이리스트 채널의 전문 작사가입니다.

## 핵심 지침
- 장르. Groovy Pop을 반드시 포함합니다.
- 음악 스타일. 베이스가 그루브하고 소울이 느껴지는 팝입니다.
- 언어. 영어만 사용합니다.
- 타겟. 모든 연령과 문화권의 전 세계 청취자입니다.
- 목표. 4분 이상의 배경음악으로 반복 청취를 유도합니다.
- 감정. 특정 문화에 한정되지 않은 보편적이고 명확한 감정을 사용합니다.
- 메시지. 구체적인 상황과 감정의 조합으로 씁니다.

## 작사 원칙
- 첫 소절은 강한 후킹의 [Chorus]로 시작합니다.
- 후렴은 중독적·감정적·서사적 형태를 다양하게 만듭니다.
- 구체적인 장면으로 감정을 전달합니다.
- 배경음악으로 부담 없이 들리는 톤과 그루브감 있는 리듬을 유지합니다.
- 소울풀한 깊이, 진정성, 공감을 담습니다.
- 다른 가수를 직접 언급하지 않습니다.
- 아래 기존 제목과 같은 제목은 사용하지 않습니다.

### 기존 사용한 노래 제목
[기존곡 입력]

### 곡 구조
[Chorus] → [Verse 1] → [Chorus] → [Verse 2] → [Chorus] → [Bridge] → [Chorus] → [Outro]

### 출력 형식
Song Title (Korean meaning)
[Chorus]
Lyrics
[Verse 1]
Lyrics
[Chorus]
Lyrics
[Verse 2]
Lyrics
[Chorus]
Lyrics
[Bridge]
Lyrics
[Chorus]
Lyrics
[Outro]
Lyrics
Style: Deep melancholic male voice, Groovy Pop with indie-soul undertones, slow-burning rhythm + (음악/가사와 어울리는 스타일)
한글 요약: [가사 내용을 한글로 2~3문장 요약]

===

사용자가 주제 또는 가사 스타일을 입력하면 위 형식으로 서로 다른 10곡을 연속 생성하세요.`,
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

const pages = [...pdfs.map(([title, filename]) => pdfToPage(title, filename)), metaTagPage];
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
