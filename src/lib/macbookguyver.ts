// 맥북가이버(jocoding.net/macbookguyver) 회차별 자동화 가이드 — 정적 데이터와 치환 헬퍼
// 프롬프트 본문은 회차의 자동화 흐름을 참고해 새로 작성한 템플릿이다. 원문은 sourceUrl에서 본다.

export type GuideField = { key: string; label: string; defaultValue: string };

export type GuidePrompt = {
  id: string;
  title: string;
  where: string;
  /** {{key}} 자리에 내 정보 값이 들어간다. */
  text: string;
  note?: string;
};

export type GuideSection = {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  steps?: string[];
  prompts: GuidePrompt[];
  tips?: { title: string; body: string }[];
  table?: { head: string[]; rows: string[][] };
};

export type GuideEpisode = {
  slug: string;
  number: number;
  guest: string;
  date: string;
  title: string;
  summary: string;
  tools: string[];
  sourceUrl: string;
  fields: GuideField[];
  sections: GuideSection[];
};

export const MACBOOKGUYVER_HOME = "https://jocoding.net/macbookguyver/";

const enjoycouple: GuideEpisode = {
  slug: "enjoycouple",
  number: 1,
  guest: "엔조이커플",
  date: "2026.09.23",
  title: "맥미니에 AI 직원 세팅하기",
  summary:
    "ChatGPT Codex와 플러그인으로 트렌드 리서치, Slack 아이디어 수집, 협업 메일 초안, 재무 질의, 쇼츠 멀티 업로드를 자동화한 회차입니다.",
  tools: ["Codex", "ChatGPT Work", "Computer Use", "vidIQ", "Slack", "Gmail", "Google Drive", "Clobe"],
  sourceUrl: "https://jocoding.net/macbookguyver/enjoycouple/",
  fields: [
    { key: "channel", label: "채널·회사 이름", defaultValue: "엔조이커플" },
    { key: "region", label: "대상 지역", defaultValue: "한국" },
    { key: "genres", label: "관심 장르", defaultValue: "커플·먹방·챌린지·코미디·육아" },
    { key: "reportTime", label: "매일 리포트 시각", defaultValue: "오전 9시" },
    { key: "sheetName", label: "구글 시트 이름", defaultValue: "엔조이커플 아이디어 DB - Slack 자동수집" },
    { key: "deckFile", label: "소개서 파일명 (Drive)", defaultValue: "2026 enjoycouple 소개서.pdf" },
    { key: "platforms", label: "업로드 플랫폼", defaultValue: "YouTube, TikTok, 네이버 클립, Instagram, Facebook" },
    { key: "facebookPage", label: "Facebook 페이지 주소", defaultValue: "https://www.facebook.com/enjoycouple" },
  ],
  sections: [
    {
      id: "setup",
      kicker: "준비",
      title: "시작 전 세팅",
      summary: "별도 에이전트 없이 ChatGPT 데스크톱 앱의 Codex와 플러그인만으로 구성합니다.",
      steps: [
        "ChatGPT 데스크톱 앱 좌측 상단에서 Codex 모드로 전환합니다.",
        "플러그인 메뉴에서 Computer Use, Chrome, vidIQ, Slack, Google Drive, Gmail, Plugin Creator를 설치합니다.",
        "입력창에 @를 치면 설치한 플러그인을 불러올 수 있습니다.",
        "항상 켜 두는 맥미니 같은 기기에 세팅하면 예약 작업이 계속 돕니다.",
      ],
      prompts: [
        {
          id: "warmup",
          title: "워밍업: 화면 조작 권한 확인",
          where: "Computer Use · Codex 데스크톱",
          text: "계산기 앱을 직접 열어서 128 ÷ 4를 계산하고, 화면에 나온 결과를 알려줘.",
          note: "권한 요청 창이 뜨면 허용하세요. 간단한 앱 조작이 되는지 먼저 확인하는 용도입니다.",
        },
      ],
    },
    {
      id: "trend",
      kicker: "자동화 1 · 트렌드",
      title: "트렌드 탐색 → vidIQ 검증 → 매일 리포트",
      summary: "브라우저로 트렌드 신호를 모으고 vidIQ의 시간당 조회수(VPH)로 걸러 낸 뒤, 같은 흐름을 매일 예약합니다.",
      prompts: [
        {
          id: "trend-browse",
          title: "① 브라우저로 트렌드 신호 모으기",
          where: "@Chrome · Codex 데스크톱",
          text: `@Chrome
[목표] {{region}}에서 지금 막 오르고 있는 {{genres}} 관련 소재를 찾아, {{channel}} 콘텐츠 후보로 정리한다.

[볼 곳] Google Trends → 네이버 데이터랩 → TikTok Creative Center → YouTube Shorts 검색 → 국내 커뮤니티 인기글

[규칙]
- 페이지를 깊게 파지 말고 제목, 날짜, 조회수, 검색량 변화 같은 겉으로 보이는 신호만 본다.
- 같은 현상은 하나로 합치고, 후보는 최대 10개로 줄인다.
- 로그인 등으로 못 본 정보는 비워 두고 "확인 불가"라고 쓴다.

[출력] 표 한 개: 소재 | 어디서 봤나 | 오르고 있다는 근거 | 링크 | {{channel}}에 맞는 정도(상/중/하) | 주의할 점`,
        },
        {
          id: "trend-vidiq",
          title: "② vidIQ로 진짜 뜨는지 검증",
          where: "@vidIQ · 같은 채팅에서 이어서",
          text: `@vidIQ
위 후보 중 실제로 조회수가 붙고 있는 것을 YouTube 공개 데이터로 가려 줘.

- 기준: 최근 30일, {{region}} Shorts. 누적 조회수가 아니라 VPH(시간당 조회수) 순으로 본다.
- {{channel}}과 결이 비슷한 채널 최대 5곳을 고르고, 고른 이유를 한 줄씩 적는다.
- 그 채널들의 최근 Shorts를 조회수, VPH, 아웃라이어 점수, 제목 패턴, 반복 포맷으로 비교한다.
- 끝에 {{channel}}용 아이디어 3개. 다른 채널의 장면·대사·편집은 가져오지 말고 형식만 참고한다.
- 넓은 검색이 막히면 급상승 VPH → 비슷한 채널 → 채널별 아웃라이어 순으로 좁혀서 찾는다.`,
          note: "VPH는 시간당 조회수 증가량이라, 지금 빠르게 크는 영상을 찾는 데 씁니다.",
        },
        {
          id: "trend-schedule",
          title: "③ 매일 아침 리포트 예약",
          where: "예약 작업 · 같은 채팅에서 이어서",
          text: `이 조사를 매일 {{reportTime}}에 자동으로 돌리고 "{{channel}} 아침 트렌드 리포트"로 보내줘.

순서: 트렌드 사이트에서 상승 후보 수집 → vidIQ로 VPH·비슷한 채널·아웃라이어 확인 → 중복 제거

리포트 구성
1. 오늘의 트렌드 (최대 10)
2. 빠르게 크는 Shorts (최대 10) — 제목 / 채널 / 조회수 / VPH / 링크
3. 경쟁 채널이 반복하는 포맷 3가지
4. {{channel}}에 바로 쓸 아이디어 5개
5. 저작권·브랜드 안전 체크
6. 참고 링크

막히는 페이지는 검색 결과와 공개 썸네일로 대신하고, 필요한 정보가 모이면 거기서 멈춘다. 모르는 값은 채우지 않는다.`,
          note: "조사를 했던 같은 채팅에서 보내야 앞의 맥락이 예약에 함께 담깁니다. 예약은 맥이 켜져 있어야 실행됩니다.",
        },
      ],
      tips: [
        { title: "쇼핑몰·브랜드라면", body: "볼 곳을 쇼핑 랭킹·쇼핑 인사이트로 바꾸고, '맞는 정도' 대신 '우리 상품과 연결 가능성'을 쓰게 하세요." },
        { title: "B2B·교육 채널이라면", body: "장르를 업계 키워드로 바꾸고 업계 커뮤니티를 볼 곳에 추가하세요." },
        { title: "리포트가 길다면", body: "항목 개수를 줄이면 더 빨리 끝나고 사용량도 줄어듭니다." },
      ],
    },
    {
      id: "slack",
      kicker: "자동화 2 · 아이디어 수집",
      title: "Slack 링크 → 구글 시트 자동 분류",
      summary: "채널에 링크가 올라올 때마다 실행되는 이벤트형 자동화입니다. chatgpt.com의 Work 모드에서 만듭니다.",
      steps: [
        "Slack, Google Drive 플러그인을 설치하고 구글 시트를 미리 만들어 둡니다. 시트 이름은 프롬프트와 정확히 같아야 합니다.",
        "chatgpt.com에서 Work 모드로 바꾸고 두 플러그인을 붙인 채 프롬프트를 보냅니다.",
        "Slack 채널에서 /invite @ChatGPT 로 초대합니다.",
        "모니터링 상태가 되면 링크를 올려 테스트합니다.",
      ],
      prompts: [
        {
          id: "slack-event",
          title: "새 Slack 메시지 → 시트 저장",
          where: "Slack · Google Drive · chatgpt.com Work",
          text: `[트리거] Slack #아이디어-수집 채널에 새 글이 올라올 때. 스레드 댓글은 제외.

[처리]
- 먼저 원글 스레드에 "확인하고 있어요 ⏳" 댓글을 단다.
- 이번에 들어온 글 한 건만 본다. 채널의 이전 기록은 읽지 않는다.
- 링크, 본문, 첨부 이미지를 보고 플랫폼 / 제목 / 카테고리 / 밈 유형 / 핵심 훅 / {{channel}} 활용법 / 난이도 / 원본 링크를 채운다.

[저장] 구글 시트 "{{sheetName}}"
- 키는 메시지 ID + 추적 파라미터(?si=, utm_ 등)를 뗀 URL. 있으면 고치고 없으면 추가한다.
- 이미 성공한 링크는 새 줄을 만들지 않는다. 오류로 남아 있던 줄은 다시 분석해 덮어쓴다.
- YouTube가 안 열리면 영상 ID 검색 → 공개 메타데이터 → 썸네일 순서로 보고, 제목과 채널만 나오면 바로 저장한다.

[마무리]
- 성공: 스레드에 "저장했어요 ✅"와 분류 요약
- 실패: 시트 상태 칸에 "오류"와 원인, 스레드에 "일부는 확인이 필요해요 ⚠️"

첫 댓글은 10초, 저장은 1분 안에 끝내는 것을 목표로 한다.`,
        },
        {
          id: "slack-invite",
          title: "채널 초대 후 다시 연결",
          where: "같은 채팅",
          text: "Slack 채널에 @ChatGPT 초대했어. 모니터링 다시 시작해줘.",
          note: "시트를 못 찾는다고 하면 시트 링크를 붙여 주세요.",
        },
      ],
    },
    {
      id: "mail",
      kicker: "자동화 3 · 메일",
      title: "협업 문의 메일 → 답장 초안 + 소개서 첨부",
      summary: "광고·협업 메일만 골라 분류하고 답장은 임시보관함에만 만듭니다. 발송은 사람이 직접 합니다.",
      steps: [
        "Gmail, Google Drive 플러그인을 설치하고 소개서 PDF를 Drive에 올려 둡니다.",
        "chatgpt.com Work 모드에서 두 플러그인을 붙이고 프롬프트를 보냅니다.",
        "규칙은 사이드바의 예약 작업에서 한글로 고칠 수 있습니다.",
      ],
      prompts: [
        {
          id: "mail-draft",
          title: "새 메일 → 분류 → Draft",
          where: "Gmail · Google Drive · chatgpt.com Work",
          text: `[트리거] 새 메일 수신. 제목이나 본문에 광고, 협업, 브랜디드, 출연, 단가, 견적 같은 단어가 있을 때만.
[범위] 방금 들어온 스레드 하나만. 받은편지함·임시보관함을 훑지 않는다.

[분류] 스팸·가능성 낮음 / 단순 문의 / 조건이 모호한 협업 / 정식 견적 요청 — 판단 근거를 한 문단으로.

[답장]
- 스팸은 답장하지 않는다.
- 나머지는 이 스레드에 Draft만 만든다. 절대 보내지 않는다.
- 정식 견적·단가 문의면 Drive에서 "{{deckFile}}"을 정확한 이름으로 찾아 첨부한다. 파일 ID를 줬다면 ID가 우선이다.
- 메일에 없는 금액, 일정, 가능 여부는 지어내지 않는다. 필요한 정보를 되묻는 질문으로 채운다.
- 같은 스레드에 Draft가 이미 있으면 새로 만들지 말고 그 Draft를 고친다.

[보고] 메일 제목 / 분류 / Draft 여부 / 첨부 파일 / "발송하지 않음"
30초 안에 끝낸다.`,
        },
      ],
      tips: [
        { title: "분류 바꾸기", body: "행사 문의, 인터뷰 요청처럼 실제로 받는 메일 유형으로 분류 항목을 바꾸세요." },
        { title: "말투 맞추기", body: "\"최근 보낸 답장 몇 개의 말투를 따라 쓴다\"를 추가하면 담당자 문체에 가까워집니다." },
        { title: "담당자 알림", body: "정식 견적이면 Slack 영업 채널에 제목과 링크를 남기게 하세요. 발송은 여전히 사람이 합니다." },
      ],
    },
    {
      id: "finance",
      kicker: "자동화 4 · 재무",
      title: "Clobe로 통장·카드 내역에 말로 묻기",
      summary: "은행·카드 내역을 모아 주는 Clobe를 MCP로 Codex에 붙입니다. 공식 플러그인이 없어도 Plugin Creator로 만들 수 있습니다.",
      steps: [
        "clobe.ai에 가입하고 계좌·카드를 연동합니다.",
        "Clobe 앱의 MCP 연결 메뉴에서 ChatGPT용 연결 안내문을 복사합니다.",
        "Codex에서 @Plugin Creator를 부르고 안내문을 붙여넣어 보냅니다.",
        "설치가 끝나면 연결 확인 프롬프트를 보낸 뒤 자연어로 질문합니다.",
      ],
      prompts: [
        {
          id: "finance-plugin",
          title: "안내문으로 플러그인 만들기",
          where: "@Plugin Creator · Codex 데스크톱",
          text: `@Plugin Creator
[여기에 Clobe의 MCP 연결 안내문 전체를 붙여넣기]

위 안내를 바탕으로 원격 MCP 서버 https://api.clobe.ai/mcp 에 붙는 Codex 플러그인을 만들어 설치해줘. 인증은 OAuth 로그인으로 하고, 설치 뒤 실제로 연결되는지 확인까지 해줘.`,
          note: "처음이면 macOS 개발자 도구 설치 창이 뜰 수 있습니다. 허용하면 됩니다.",
        },
        {
          id: "finance-check",
          title: "연결 확인",
          where: "clobe · Codex 데스크톱",
          text: "clobe 연결했어. get_my_context로 내 회사 목록을 보여주고, 여기서 할 수 있는 일을 정리해줘.",
          note: "도구가 0개로 보이면 OAuth 로그인이 안 끝난 경우가 많습니다. 인증 후 새 채팅을 여세요.",
        },
        {
          id: "finance-ask",
          title: "재무 질문하기",
          where: "clobe · Codex 데스크톱",
          text: `매달 반복해서 나가는 구독·서비스 비용을 찾아 표로 정리해줘: 항목 | 월 금액 | 주기 | 확인한 기간.
조회만 하고 데이터는 수정하지 마.

이어서 물어볼 것
- 지난달 지출 상위 5건
- 이번 달 입금이 많은 거래처 1~3위 (내 계좌끼리 이체는 제외)
- {{channel}} 메일에서 입금하겠다고 한 건 중 아직 안 들어온 것
- 증빙이 빠진 지출`,
          note: "세금·공제 같은 최종 판단은 세무 전문가에게 확인하세요.",
        },
      ],
    },
    {
      id: "upload",
      kicker: "자동화 5 · 업로드",
      title: "쇼츠 하나를 여러 SNS에 한 번에",
      summary: "공개된 shorts-multiuploader 예시 코드를 주고 Codex가 내 플랫폼에 맞게 고치게 합니다.",
      steps: [
        "아래 프롬프트를 Codex 새 채팅에 보냅니다.",
        "Chrome에 플랫폼별 로그인 창이 뜨면 직접 로그인하고 완료라고 답합니다.",
        "완성되면 @ 메뉴에 Shorts Multiuploader가 생깁니다.",
        "처음에는 dry-run으로 계획만 확인합니다.",
      ],
      prompts: [
        {
          id: "upload-build",
          title: "예시 코드로 내 업로더 만들기",
          where: "Codex 데스크톱",
          text: `https://github.com/youtube-jocoding/shorts-multiuploader
이 저장소를 출발점으로 {{channel}}의 쇼츠를 {{platforms}}에 동시에 올리는 도구를 만들어줘.
- YouTube에 이미 올린 쇼츠를 내려받아 나머지 플랫폼에 다시 올리는 방식
- 광고·협찬으로 보이는 영상은 기본 제외
- 첫 실행은 --dry-run으로 계획만 보여주고, 내가 승인하면 실제로 올린다`,
        },
        {
          id: "upload-follow",
          title: "후속 지시: 로그인·계정 고정",
          where: "같은 채팅",
          text: `(Chrome 로그인 창에서 직접 로그인한 뒤)
로그인 다 했어. Facebook은 개인 프로필이 아니라 {{facebookPage}} 페이지로 올려야 해. 이 설정 기억해 둬.`,
          note: "로그인 세션과 설정은 Git에 올라가지 않는 로컬 .env에 저장됩니다.",
        },
        {
          id: "upload-run",
          title: "이제부터는 한 줄로",
          where: "@Shorts Multiuploader · 휴대폰 원격 가능",
          text: "@Shorts Multiuploader {{channel}} YouTube 채널의 가장 최근 쇼츠 1개를 모든 플랫폼에 올려줘.",
          note: "직접 만들었거나 재배포 권리가 있는 영상만 올리세요. 성공 여부가 애매하면 다시 올리기 전에 게시됐는지 먼저 확인하게 하세요.",
        },
      ],
    },
    {
      id: "remote",
      kicker: "보너스",
      title: "스마트폰으로 맥미니에 일 시키기",
      summary: "휴대폰 ChatGPT 앱에서 보낸 지시를 사무실 맥이 실행합니다.",
      steps: [
        "맥: 설정의 코딩 → 연결 → 이 Mac 제어에서 추가하고 제어를 허용합니다. 전원 연결 후 잠자기를 끕니다.",
        "휴대폰: 프로필 → 원격 제어에서 맥 화면의 QR로 페어링합니다. 두 기기는 같은 ChatGPT 계정이어야 합니다.",
      ],
      prompts: [
        {
          id: "remote-summary",
          title: "휴대폰에서 보내기 좋은 지시",
          where: "ChatGPT 모바일 앱 · 원격 제어",
          text: `오늘 돌아간 {{channel}} 자동화 결과를 완료 / 검토 필요 / 실패로 나눠 알려줘.
메일 발송이나 게시처럼 내 승인이 필요한 건 맨 위에 올려 주고, Gmail Draft는 보내지 말고 제목과 첨부만 확인해줘.`,
        },
      ],
    },
    {
      id: "apply",
      kicker: "응용",
      title: "내 업무에 응용하기",
      summary: "자동화 프롬프트를 빠르고 안전하게 만드는 공통 원칙과, 새 업무용 프롬프트를 AI에게 쓰게 하는 템플릿입니다.",
      table: {
        head: ["피할 것", "대신 이렇게"],
        rows: [
          ["\"알아서 다 찾아 처리해\"", "이번에 들어온 한 건, 특정 채널·스레드·파일만 지정"],
          ["가능한 방법을 끝까지 전부 시도", "필요한 정보가 모이면 멈추게 하기"],
          ["끝날 때까지 무반응", "시작 알림 + 완료·오류 알림"],
          ["매번 전체를 검색해 중복 확인", "메시지 ID·파일 ID·정리한 URL로 중복 방지"],
          ["메일 자동 발송, 세무 자동 확정", "초안·dry-run까지만, 최종은 사람이 승인"],
          ["모르는 값을 그럴듯하게 채움", "\"확인 불가\"로 남기기"],
          ["실패를 조용히 넘김", "오류와 원인을 기록하고 재처리 조건 남기기"],
        ],
      },
      prompts: [
        {
          id: "apply-template",
          title: "새 업무용 프롬프트를 AI에게 만들게 하기",
          where: "ChatGPT · Codex 어디서나",
          text: `{{channel}}에서 [반복 업무]를 매번 손으로 하고 있어. 이걸 Codex/ChatGPT 자동화에 맡길 프롬프트를 써줘.

포함할 것
- 실행 시점을 하나로: 정해진 시각 / 새 메일 / 새 Slack 글
- 들어온 한 건만 처리, 과거 기록은 다시 보지 않기
- 시작 알림과 완료·오류 알림
- ID나 URL로 중복 막기
- 발송·게시·결제·확정은 초안이나 dry-run까지만, 최종은 내 승인
- 모르는 값은 "확인 불가"
- 결과 형식(표, 필드 이름)을 구체적으로`,
        },
      ],
    },
  ],
};

const EPISODES: GuideEpisode[] = [enjoycouple];

export function listEpisodes(): GuideEpisode[] {
  return EPISODES;
}

export function getEpisodeBySlug(slug: string): GuideEpisode | undefined {
  return EPISODES.find((e) => e.slug === slug);
}

export function defaultFieldValues(fields: GuideField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.defaultValue]));
}

export type PromptPart = { type: "text"; value: string } | { type: "field"; key: string; value: string };

/** {{key}} 자리를 값으로 바꿔 조각 배열로 돌려준다. 빈 값이면 기본값을 쓴다. */
export function splitPromptParts(
  text: string,
  values: Record<string, string>,
  defaults: Record<string, string>
): PromptPart[] {
  const parts: PromptPart[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ type: "text", value: text.slice(last, idx) });
    const key = m[1];
    const value = values[key]?.trim() || defaults[key] || m[0];
    parts.push({ type: "field", key, value });
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

export function fillPrompt(
  text: string,
  values: Record<string, string>,
  defaults: Record<string, string>
): string {
  return splitPromptParts(text, values, defaults)
    .map((p) => p.value)
    .join("");
}
