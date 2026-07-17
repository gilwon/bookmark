// GitHub Star 영문 설명에 한국어 번역을 병기하고 이후 동기화에도 보존한다
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^(["'])|(["'])$/g, "");
  }
}

const translations = {
  "addyosmani/agent-skills": "AI 코딩 에이전트를 위한 프로덕션급 엔지니어링 스킬 모음.",
  "affaan-m/ECC": "Claude Code, Codex, OpenCode, Cursor 등을 위한 에이전트 하니스 성능 최적화 시스템. 스킬, 행동 원칙, 메모리, 보안, 리서치 우선 개발을 제공합니다.",
  "alvarotrigo/fullPage.js": "Alvaro Trigo의 fullPage 플러그인. 전체 화면 페이지를 빠르고 쉽게 만듭니다.",
  "alvarotrigo/pagePiling.js": "Alvaro Trigo의 pagePiling 플러그인. 섹션을 쌓아 넘기는 스크롤 페이지를 만듭니다.",
  "anthropics/claude-for-legal": "법률 업무용 플러그인 모음.",
  "anthropics/skills": "Agent Skills 공개 저장소.",
  "asgeirtj/system_prompts_leaks": "Anthropic, OpenAI, Google, xAI, Cursor, Copilot 등 여러 제품에서 추출한 시스템 프롬프트 모음. 정기적으로 업데이트됩니다.",
  "ashishpatel26/500-AI-Agents-Projects": "헬스케어, 금융, 교육, 유통 등 산업별 AI 에이전트 활용 사례 500개와 구현용 오픈소스 프로젝트 링크를 모은 큐레이션.",
  "careerhackeralex/visualize": "프롬프트 한 번으로 어떤 아이디어든 아름다운 HTML 시각화로 만드는 Claude Code 스킬.",
  "ChipSpiderWarm/r15-shanraisshan-claude-code-best-practice-devops": "shanraisshan/claude-code-best-practice에서 파생한 DevOps 및 클라우드 인프라 스킬 모음.",
  "cobusgreyling/loop-engineering": "AI 코딩 에이전트로 루프 엔지니어링을 하기 위한 실전 패턴, 스타터, CLI 도구 모음. 에이전트를 프롬프트하고 오케스트레이션하는 시스템을 설계합니다.",
  "code-yeongyu/lazycodex": "복잡한 코드베이스를 위한 에이전트 하니스. Codex 안에서 프로젝트 메모리, 계획, 실행, 검증된 완료를 제공합니다.",
  "codecrafters-io/build-your-own-x": "좋아하는 기술을 처음부터 다시 만들어 보며 프로그래밍을 익히는 학습 자료 모음.",
  "coreyhaines31/marketingskills": "Claude Code와 AI 에이전트를 위한 마케팅 스킬. CRO, 카피라이팅, SEO, 분석, 그로스 엔지니어링을 포함합니다.",
  "damulhan/ciboard-pagemenu2": "CIBoard용 메뉴 빌더. CIBoard는 CodeIgniter 기반 CMS입니다.",
  "dandacompany/deskrpg": "캐릭터 생성, 채널 참여, AI NPC 대화, 실시간 협업을 지원하는 2D 픽셀아트 멀티플레이 가상 오피스 게임.",
  "datajuny/andrej-karpathy-skills": "Andrej Karpathy의 LLM 코딩 실패 사례 관찰에서 파생한, Claude Code 동작을 개선하는 단일 CLAUDE.md 파일.",
  "DeusData/codebase-memory-mcp": "고성능 코드 인텔리전스 MCP 서버. 코드베이스를 영속 지식 그래프로 색인하며, 158개 언어와 서브밀리초 쿼리, 토큰 99% 절감을 지원합니다.",
  "diffusionstudio/lottie": "Claude Code 또는 Codex로 프로덕션용 Lottie 애니메이션을 생성합니다.",
  "emilkowalski/skills": "디자인 엔지니어를 위한 스킬 모음.",
  "facebook/astryx": "완전한 커스터마이즈와 에이전트 활용이 가능한 오픈소스 디자인 시스템.",
  "fivetaku/insane-search": "Claude Code에서 차단된 웹사이트를 우회하는 도구. API 키 없이 단계형 적응 스케줄러를 사용합니다.",
  "gnuboard/rn": "그누보드5용 React Native 프로젝트.",
  "google-labs-code/design.md": "코딩 에이전트에게 시각 아이덴티티를 설명하는 형식 명세. DESIGN.md로 디자인 시스템을 영속적이고 구조적으로 이해시킵니다.",
  "gsd-build/get-shit-done": "TÂCHES가 만든 Claude Code용 경량 메타 프롬프팅, 컨텍스트 엔지니어링, 스펙 주도 개발 시스템.",
  "HKUDS/OpenHarness": "개인 에이전트 Ohmo가 내장된 오픈 에이전트 하니스.",
  "JCodesMore/ai-website-cloner-template": "AI 코딩 에이전트로 명령 한 번에 웹사이트를 복제하는 템플릿.",
  "jiunbae/oh-my-prompt": "MinIO에 저장된 Claude Code 프롬프트를 분석하는 대시보드.",
  "JuliusBrussee/caveman": "원시인처럼 짧게 말해 토큰을 65% 절감하는 Claude Code 스킬.",
  "K-Dense-AI/scientific-agent-skills": "AI 에이전트를 AI 과학자로 바꾸는 과학용 Agent Skills 라이브러리. 즉시 사용 가능한 148개 스킬과 100개 이상 과학 데이터베이스를 제공합니다.",
  "krea-ai/krea-2": "Krea 2 공식 추론 코드.",
  "Leonxlnx/taste-skill": "AI에게 좋은 미적 감각을 부여해 지루하고 평범한 결과물 생성을 막는 Taste-Skill.",
  "magicuidesign/magicui": "디자인 엔지니어용 UI 라이브러리. 앱에 복사해 붙일 수 있는 애니메이션 컴포넌트와 효과를 제공하는 무료 오픈소스입니다.",
  "mattpocock/dictionary-of-ai-coding": "AI 코딩 용어를 쉬운 영어로 설명한 사전.",
  "mattpocock/skills": "실무 엔지니어를 위한 스킬. .claude 디렉터리에서 바로 가져왔습니다.",
  "mcneel/RhinoMCP": "Rhino용 AI 기능.",
  "modu-ai/cc-plugins": "Auth0 보안, MFA, 토큰 보안, 컴플라이언스 등 다양한 분야를 위한 Claude Code 플러그인 모음.",
  "mukul975/Anthropic-Cybersecurity-Skills": "AI 에이전트용 구조화된 사이버보안 스킬 817개. 6개 프레임워크에 매핑되어 있으며 29개 보안 도메인을 지원합니다.",
  "multica-ai/andrej-karpathy-skills": "Andrej Karpathy의 LLM 코딩 실패 사례 관찰에서 파생한, Claude Code 동작을 개선하는 단일 CLAUDE.md 파일.",
  "mvanhorn/last30days-skill": "Reddit, X, YouTube, HN, Polymarket, 웹 전반에서 주제를 조사한 뒤 근거 있는 요약을 만드는 AI 에이전트 스킬.",
  "Nagi-ovo/gemini-voyager": "타임라인 탐색, 폴더 관리, 프롬프트 라이브러리, 채팅 내보내기를 하나로 제공하는 Google Gemini 및 AI Studio 확장 기능.",
  "nank1ro/flutter-shadcn-ui": "Flutter로 포팅한 shadcn-ui. 완전히 커스터마이즈 가능한 Flutter UI 컴포넌트 모음.",
  "nexibase/nexibase": "플러그인 기반 커뮤니티 플랫폼 NexiBase.",
  "nextlevelbuilder/ui-ux-pro-max-skill": "여러 플랫폼에서 전문적인 UI/UX를 만들기 위한 디자인 인텔리전스를 제공하는 AI 스킬.",
  "nexu-io/open-design": "오픈소스 Claude Design 대안. 로컬 우선 데스크톱 앱에서 코딩 에이전트로 프로토타입, 랜딩 페이지, 대시보드, 슬라이드, 이미지, 영상을 만들고 다양한 파일로 내보냅니다.",
  "nidhinjs/prompt-master": "모든 AI 도구에 정확한 프롬프트를 작성하는 Claude 스킬. 토큰과 크레딧 낭비를 줄이고 전체 맥락과 메모리를 유지합니다.",
  "Nutlope/hallmark": "Claude Code, Cursor, Codex용 AI 슬롭 방지 디자인 스킬.",
  "obra/superpowers": "실제로 작동하는 에이전틱 스킬 프레임워크와 소프트웨어 개발 방법론.",
  "OpenCut-app/OpenCut": "오픈소스 CapCut 대안.",
  "oraios/serena": "시맨틱 검색과 편집 기능을 제공하는 강력한 코딩용 MCP 툴킷. 에이전트를 위한 IDE입니다.",
  "outsourc-e/hermes-workspace": "Hermes Agent용 네이티브 웹 워크스페이스. 채팅, 터미널, 메모리, 스킬, 인스펙터를 제공합니다.",
  "php-coveralls/php-coveralls": "Coveralls API용 PHP 클라이언트 라이브러리.",
  "phuryn/pm-skills": "발견, 전략, 실행, 출시, 성장 전반을 다루는 100개 이상 에이전틱 스킬·명령·플러그인 마켓플레이스.",
  "remotion-dev/remotion": "React로 영상을 프로그래밍 방식으로 만듭니다.",
  "remotion-dev/skills": "에이전트 스킬 모음.",
  "revfactory/harness": "도메인별 에이전트 팀을 설계하고 전문 에이전트와 사용하는 스킬을 생성하는 메타 스킬.",
  "rtk-ai/rtk": "일반적인 개발 명령에서 LLM 토큰 사용량을 60~90% 줄이는 CLI 프록시. 단일 Rust 바이너리이며 의존성이 없습니다.",
  "sangrokjung/cc-menubar": "Claude Code 사용량·비용과 teamclaude 계정 순환 상태를 보여주는 macOS 메뉴바 앱. 네이티브 Swift 단일 바이너리입니다.",
  "shadcn-ui/ui": "아름답고 접근성 높은 컴포넌트 모음과 코드 배포 플랫폼. 즐겨 쓰는 프레임워크에서 사용할 수 있는 오픈소스입니다.",
  "SheenEmpress/r14-borghei-claude-skills-seo": "borghei/Claude-Skills에서 파생한 SEO 및 콘텐츠 마케팅 스킬 모음.",
  "Significant-Gravitas/AutoGPT": "누구나 접근할 수 있는 AI를 사용하고 구축할 수 있게 하려는 AutoGPT의 비전. 중요한 일에 집중할 수 있도록 도구를 제공합니다.",
  "stablyai/orca": "병렬 에이전트 집단을 다루는 ADE. 직접 구독으로 코딩 에이전트를 실행하며 데스크톱과 모바일에서 사용할 수 있습니다.",
  "steipete/CodexBar": "로그인 없이 OpenAI Codex와 Claude Code의 사용량 통계를 보여줍니다.",
  "TauricResearch/TradingAgents": "멀티에이전트 LLM 금융 트레이딩 프레임워크.",
  "thedotmack/claude-mem": "모든 에이전트의 세션 간 영속 컨텍스트. 세션 활동을 수집·AI 압축하고 이후 세션에 관련 맥락을 다시 주입합니다.",
  "tt-a1i/archify": "다크·라이트 테마 전환과 PNG, JPEG, WebP, SVG 내보내기를 지원하는 아름다운 아키텍처 다이어그램 생성 에이전트 스킬.",
  "ultraworkers/claw-code": "Gajae-Code와 LazyCodex로 만든 Rust 기반 에이전트 운영 박물관 전시물. 사람 개입 없이 개발·유지보수됩니다.",
  "upstash/context7": "LLM과 AI 코드 에디터를 위한 최신 코드 문서 Context7 플랫폼.",
  "uxjoseph/supanova-design-skill": "AI에게 좋은 미적 감각을 부여해 지루하고 평범한 결과물 생성을 막는 Taste-Skill.",
  "volition79/gpt-5.6-router": "Codex용 적응형 GPT-5.6 Sol, Terra, Luna 라우팅 스킬.",
  "VoltAgent/awesome-design-md": "인기 브랜드 디자인 시스템의 DESIGN.md 분석 모음. 프로젝트에 넣으면 코딩 에이전트가 어울리는 UI를 생성합니다.",
  "yan-labs/serenity-aleabitoreddit": "설치 가능한 Serenity 트윗 아카이브와 AI·반도체 공급망 스킬. npx skills add로 설치합니다.",
  "Yeachan-Heo/gajae-code": "Gajae Code MVP.",
  "Yeachan-Heo/oh-my-claudecode": "Claude Code를 위한 팀 우선 멀티에이전트 오케스트레이션.",
  "zubair-trabzada/geo-seo-claude": "Claude Code용 GEO 우선 SEO 스킬. 인용 가능성 점수, AI 크롤러 분석, 브랜드 권위, 스키마 마크업, 플랫폼별 최적화, PDF 보고서를 제공합니다.",
};

const separator = "\n\n";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const { data: rows, error } = await sb
  .from("github_stars")
  .select("id, repo_full_name, description");
if (error) throw error;

let updated = 0;
for (const row of rows) {
  const translation = translations[row.repo_full_name];
  if (!translation || !row.description || row.description.includes(separator)) continue;
  const { error: updateError } = await sb
    .from("github_stars")
    .update({ description: `${row.description.trim()}${separator}${translation}` })
    .eq("id", row.id);
  if (updateError) throw updateError;
  updated++;
}
console.log({ updated, translations: Object.keys(translations).length });
