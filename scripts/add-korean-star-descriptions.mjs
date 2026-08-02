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
  "Yeachan-Heo/gajae-code": "Gajae Code의 MVP.",
  "Yeachan-Heo/oh-my-claudecode": "Claude Code를 위한 팀 우선 멀티에이전트 오케스트레이션.",
  "zubair-trabzada/geo-seo-claude": "Claude Code용 GEO 우선 SEO 스킬. 인용 가능성 점수, AI 크롤러 분석, 브랜드 권위, 스키마 마크업, 플랫폼별 최적화, PDF 보고서를 제공합니다.",
  "AgriciDaniel/claude-ads": "Claude Code에서 12개 광고 플랫폼을 다루는 Claude 우선 퍼포먼스 마케팅 운영 스킬. 근거 기반 감사, 결정론적 점수화, 버전 관리 JSON 보고서와 계정 변경을 제공합니다.",
  "aidenybai/react-grab": "에이전트를 위해 어떤 UI 요소든 복사하는 도구.",
  "alibaba/open-code-review": "Alibaba 규모에서 검증된 오픈소스 코드 리뷰 도구. 결정론적 파이프라인과 LLM 에이전트를 결합하고, 정밀한 라인 단위 댓글과 다국어 규칙을 제공합니다.",
  "artemnovitckii/content-skills": "Claude의 글쓰기를 개선하는 Claude Code 스킬 5종. 단순화, 스토리텔링, 바이럴 훅, AI 문체 제거, 보이스 DNA 가이드를 포함합니다.",
  "AThevon/genjutsu": "Claude Code용 크리에이티브 코딩 스킬. 애니메이션, 3D, 디자인 시스템과 모션 원칙을 다룹니다.",
  "block/buzz": "집단 지성 커뮤니케이션 플랫폼.",
  "bradautomates/claude-video": "Claude가 모든 영상을 볼 수 있게 합니다. /watch 명령으로 영상을 내려받고 프레임 추출과 전사를 거쳐 Claude에 전달합니다.",
  "browser-use/video-use": "코딩 에이전트로 영상을 편집하는 도구.",
  "Canner/WrenAI": "AI 에이전트를 위한 생성형 BI. 자연어 질문을 신뢰할 수 있는 대시보드, 차트와 SQL로 바꾸는 오픈소스 텍스트-SQL 플랫폼입니다.",
  "ckissi/kinetics": "고정된 지속 시간의 이징 대신 스프링 물리 기반으로 인터페이스 애니메이션을 만드는 라이브러리.",
  "cocoindex-io/cocoindex": "장기 작업 에이전트를 위한 증분 처리 엔진.",
  "coollabsio/coolify": "자체 서버에서 정적 사이트, 데이터베이스, 풀스택 애플리케이션과 280개 이상의 원클릭 서비스를 배포할 수 있는 오픈소스 PaaS.",
  "D4Vinci/Scrapling": "단일 요청부터 전체 크롤링까지 처리하는 적응형 웹 스크래핑 프레임워크.",
  "dandacompany/bluekiwi": "MCP 통합을 지원하는 오픈소스 AI 워크플로 엔진 BlueKiwi.",
  "dandacompany/oh-my-wiki": "Karpathy 스타일의 LLM Wiki 스킬. 출처를 수집하고 구조화된 위키를 만든 뒤 인용이 포함된 답변을 제공합니다.",
  "decolua/9router": "Claude Code, Codex, Cursor, Cline, Copilot, Antigravity를 40개 이상의 공급자를 통한 무료 Claude, GPT, Gemini에 연결하는 무제한 무료 AI 코딩 도구.",
  "dqev/reicon": "디자이너와 개발자를 위한 오픈소스 아이콘 라이브러리 Reicon.",
  "drumih/turbo-fieldfare": "M 시리즈 MacBook에서 약 2GB 메모리로 Gemma 4 26B-A4B를 추론하는 도구.",
  "Egonex-AI/Understand-Anything": "코드를 탐색하고 검색하며 질문할 수 있는 인터랙티브 지식 그래프. Claude Code, Codex, Cursor, Copilot, Gemini CLI 등을 지원합니다.",
  "eisenjimmy/Jimmy-s-Claude": "Claude 지침과 서브에이전트 모음.",
  "Fincept-Corporation/FinceptTerminal": "시장 분석, 투자 리서치와 경제 데이터 도구를 제공하는 현대적인 금융 애플리케이션.",
  "fivetaku/insane-research": "Claude Code용 멀티에이전트 심층 리서치 도구. 출처 대조와 품질 평가를 포함한 7단계 파이프라인을 제공합니다.",
  "Graphify-Labs/graphify": "문서, SQL 스키마, 설정과 PDF를 질의 가능한 지식 그래프로 변환하는 Claude Code, Cursor, Codex, Gemini CLI용 스킬.",
  "greensock/gsap-skills": "GSAP를 올바르게 사용하도록 AI 코딩 에이전트를 가르치는 공식 AI 스킬. 모범 사례, 애니메이션 패턴과 플러그인 사용법을 다룹니다.",
  "headroomlabs-ai/headroom": "LLM에 전달되기 전에 도구 출력, 로그, 파일과 RAG 청크를 압축하는 라이브러리·프록시·MCP 서버.",
  "heroiclabs/nakama": "게임을 위한 확장 가능한 오픈소스 게임 백엔드 서버. 멀티플레이, 매치메이킹, 리더보드, 채팅과 소셜 기능을 제공합니다.",
  "heygen-com/hyperframes": "HTML을 작성하고 영상을 렌더링하는 에이전트용 도구.",
  "HKUDS/Vibe-Trading": "개인 트레이딩 에이전트 Vibe-Trading.",
  "img2threejs/img2threejs": "참조 이미지의 대상을 코드만으로 절차적이며 품질 검증된 애니메이션용 Three.js 모델로 재구성합니다.",
  "kimyoungwopo/frontend-token-trim-skillpack": "Ponytail, Graphify와 Headroom을 결합한 Hermes Agent 프론트엔드 토큰 절감 워크플로.",
  "koala73/worldmonitor": "AI 뉴스 집계, 지정학적 모니터링과 인프라 추적을 하나로 제공하는 실시간 글로벌 정보 대시보드.",
  "kwakseongjae/oh-my-design": "Claude Code, Codex, Cursor와 OpenCode에 400개 이상의 품질 평가 DESIGN.md 레퍼런스와 스킬을 설치하는 디자인 시스템.",
  "langchain-ai/langgraph": "회복력 있는 에이전트를 구축하는 프레임워크.",
  "leodavinci1/kanbots": "각 작업을 Claude Code 또는 Codex 에이전트로 처리하는 칸반 보드 협업 인터페이스.",
  "lidge-jun/opencodex": "Codex CLI, 앱, SDK와 Claude Code에서 Claude, Gemini, Grok, DeepSeek, Ollama 등 어떤 LLM이든 사용할 수 있게 하는 범용 공급자 프록시.",
  "LottieFiles/motion-design-skill": "타이밍, 이징, 안무와 디즈니 애니메이션 원칙을 UI에 맞게 적용한 AI 에이전트용 범용 모션 디자인 원칙.",
  "MengTo/Skills": "Codex, Claude, Cursor 등 AI 코딩 에이전트를 사용하는 디자이너와 빌더를 위한 에이전트 스킬.",
  "midudev/autoskills": "한 번의 명령으로 전체 AI 스킬 스택을 설치하는 도구.",
  "millionco/react-doctor": "에이전트가 잘못 작성한 React 코드를 찾아내는 도구.",
  "mksglu/context-mode": "AI 코딩 에이전트의 컨텍스트 창을 최적화하는 도구. MCP와 훅을 통해 도구 출력을 샌드박싱하고 세션 메모리와 라우팅을 관리합니다.",
  "monarchjuno/tradingcodex": "Codex를 투자 워크플로 팀으로 바꾸는 도구.",
  "Nagi-ovo/voyager": "AI Studio, Gemini, Claude와 ChatGPT를 위한 올인원 확장 기능. 타임라인, 폴더, 프롬프트, 사용량 추적, 채팅 내보내기와 플러그인을 제공합니다.",
  "nathankim0/clean-architecture-skills": "Clean Architecture 원칙에 따라 코드를 검토하고 설계하는 Claude Code 스킬.",
  "NousResearch/hermes-agent": "사용자와 함께 성장하는 에이전트.",
  "nowork-studio/NotFair": "사업 목표를 24시간 추진하는 목표 지향 루프 기반 마케팅 에이전트.",
  "openai/codex-plugin-cc": "Claude Code에서 Codex를 사용해 코드를 리뷰하거나 작업을 위임하는 플러그인.",
  "openclaw/openclaw": "어떤 운영체제와 플랫폼에서도 사용할 수 있는 개인 AI 어시스턴트.",
  "oso95/scroll-world": "어떤 브랜드든 스크롤 가능한 3D 세계로 바꾸는 스킬.",
  "palmier-io/palmier-pro": "AI를 위해 만들어진 macOS 영상 편집기.",
  "Panniantong/Agent-Reach": "AI 에이전트가 인터넷 전체를 볼 수 있게 합니다. Twitter, Reddit, YouTube, GitHub, Bilibili, 샤오홍슈를 API 비용 없이 하나의 CLI로 읽고 검색합니다.",
  "paperclipai/paperclip": "업무용 에이전트를 관리하는 오픈소스 애플리케이션.",
  "pbakaus/impeccable": "AI 하니스의 디자인 능력을 향상시키는 디자인 언어.",
  "pireel/pireel": "MCP를 통해 어떤 AI 에이전트로도 조작할 수 있는 CapCut·ChatCut 오픈소스 대안.",
  "Q00/ouroboros": "프롬프트 대신 명세로 작업하는 에이전트 운영체제.",
  "ruvnet/ruflo": "지능형 멀티플레이어 에이전트 군집을 배포하고 자율 워크플로를 조율하는 에이전트 메타 하니스.",
  "sangrokjung/claude-forge": "oh-my-zsh에서 영감을 받은 Claude Code 플러그인 프레임워크. AI 에이전트 11개, 명령 36개, 스킬 15개와 6단계 보안 훅을 제공합니다.",
  "santifer/career-ops": "AI 코딩 CLI에서 실행되는 오픈소스 AI 취업 검색 도구. 공고를 검색하고 평가하며 이력서를 맞춤화하고 지원 현황을 추적합니다.",
  "songguoxs/seedance-prompt-skill": "Seedance 2.0 영상 프롬프트를 생성하는 프롬프트 스킬.",
  "The-Swarm-Corporation/AutoHedge": "몇 분 만에 자율 헤지펀드를 구축하는 도구. 군집 지능과 AI 에이전트로 시장 분석, 리스크 관리와 거래 실행을 자동화합니다.",
  "tirth8205/code-review-graph": "MCP와 CLI를 위한 로컬 우선 코드 인텔리전스 그래프. 코드베이스를 영속적으로 매핑해 AI 코딩 도구가 필요한 부분만 읽게 합니다.",
  "tw93/Mole": "터미널에서 Mac을 정리, 삭제, 분석, 최적화하고 모니터링하는 도구.",
  "unclecode/crawl4ai": "LLM 친화적인 오픈소스 웹 크롤러와 스크래퍼 Crawl4AI.",
  "VectifyAI/PageIndex": "벡터 데이터베이스 없이 추론 기반 RAG를 수행하는 문서 인덱스.",
  "virattt/ai-hedge-fund": "AI 헤지펀드 팀.",
  "wassgha/rescript": "브라우저에서 실행되는 오픈소스 트랜스크립트 기반 영상·오디오 편집기.",
  "wjgoarxiv/youtube-digest-skill": "YouTube 영상을 TL;DR, 핵심 요점, 타임스탬프 주장, 주제 타임라인과 주요 인용구가 담긴 구조화된 지식으로 바꾸는 Claude Code·Codex·Gemini 스킬.",
  "wshobson/agents": "Claude Code, Codex CLI, Cursor, OpenCode, GitHub Copilot과 Gemini CLI를 위한 멀티 하니스 에이전트 플러그인 마켓플레이스.",
  "yetone/kill-ai-slop": "AI가 생성한 제품의 시각·카피 습관을 설명하고 프로젝트에서 이를 제거하는 Agent Skill.",
  "YouMind-OpenLab/awesome-gpt-image-2": "GPT Image 2 프롬프트 라이브러리. 매일 갱신되는 2,000개 이상의 프롬프트와 미리보기 이미지를 제공하며 16개 언어를 지원합니다.",
  "zanwei/design-dna": "참조 UI, 스크린샷과 URL을 정량화된 Design DNA JSON으로 바꾸고 동일한 스타일의 UI를 생성하는 도구.",
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
  if (!translation || !row.description) continue;
  const existingTranslation = row.description
    .split(separator)
    .slice(1)
    .join(separator)
    .trim();
  if (existingTranslation && /[가-힣]/.test(existingTranslation)) continue;
  const original = row.description.split(separator)[0].trim();
  const { error: updateError } = await sb
    .from("github_stars")
    .update({ description: `${original}${separator}${translation}` })
    .eq("id", row.id);
  if (updateError) throw updateError;
  updated++;
}
console.log({ updated, translations: Object.keys(translations).length });
