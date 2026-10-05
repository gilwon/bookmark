# Spec: 설치 현황 메뉴
Source: intent.md (Status: draft)

## Requirements
1. 로그인한 사용자는 사이드바 `라이브러리` 섹션의 `설치 현황` 으로 `/installed-tools` 에 들어간다.
2. 상단에 모델 탭이 있다. 순서는 Claude, Codex, Grok, Gemini 이고 탭마다 스킬 수와 플러그인 수를 보인다. 선택한 탭은 쿼리 `?tool=claude` 로 유지한다. 기본은 Claude.
3. 탭 아래에 `스킬` 과 `플러그인` 두 구역이 따로 있다. 구역 제목에 개수를 붙인다.
4. 스킬 카드는 이름, 설명(두 줄 말줄임), 출처 배지(사용자·공유·번들)를 보인다. 플러그인 카드는 이름, 버전, 마켓플레이스, 설명, 포함 스킬 수를 보인다.
5. 검색창 하나가 현재 탭의 두 구역을 이름·설명으로 거른다.
6. 빈 구역은 "설치된 항목이 없습니다" 를 보인다.
7. 데이터는 `src/data/installed-tools.json` 스냅샷이다. 런타임에 파일시스템을 읽지 않는다.
8. `scripts/scan-installed-tools.mjs` 가 스냅샷을 만든다. 홈 디렉터리 경로, 토큰, 인증 정보는 쓰지 않는다. 스킬 설명은 SKILL.md 프론트매터 `description` 이다.
9. 많이 쓴 항목은 카드 색을 달리한다. 사용 횟수가 3회 이상이면 강조 색(amber 계열 테두리·배경)이고, 카드 오른쪽에 `N회` 배지를 붙인다. 1~2회는 배지만 붙이고 색은 그대로다. 라이트·다크 모두 대비를 지킨다.
10. 사용 횟수는 스캔 스크립트가 센다. Claude 는 `~/.claude/projects/**/*.jsonl` 에서 Skill 도구 호출(`input.skill`)과 슬래시 명령(`<command-name>`)을 이름별로 합산한다. 플러그인은 `플러그인:스킬` 형태 호출, `mcp__plugin_<플러그인>_` 도구 호출, `<플러그인>:` 슬래시 명령을 해당 플러그인에 합산한다. Codex·Grok·Gemini 는 신뢰할 신호가 있을 때만 센다. 없으면 0으로 두고 보고한다.
11. 설명에 한글이 없는 스킬·플러그인은 한글 설명을 함께 보인다. 카드에 한글 설명을 먼저, 영어 원문을 그 아래 흐린 글씨로 둘 다 보인다(각 두 줄 말줄임). 한글이 이미 있는 설명은 그대로 한 줄만 보인다.
12. 한글 설명은 `src/data/installed-tools-ko.json` 에 따로 둔다. 키는 `도구id/skill|plugin/이름` 이고 값은 한글 설명 문자열이다. 같은 도구 안에서 이름이 같고 출처(스킬 source, 플러그인 marketplace)만 다른 항목은 키 끝에 `/출처` 를 붙인다. 로더는 출처 붙은 키를 먼저 찾는다. 스캔 스크립트는 이 파일을 건드리지 않으므로 재스캔해도 번역이 남는다. 로더가 두 파일을 합쳐 `descriptionKo` 를 채운다.
13. 번역은 원문 의미만 옮긴다. 고유명사·명령어·파일명·스킬 이름은 원문 그대로 두고, 없던 내용을 보태지 않는다. 설명이 빈 항목은 빈 채로 둔다.
14. 출처가 확인되는 항목은 카드에 GitHub 링크(새 탭, `rel=noopener noreferrer`)와 `설치 명령 복사` 버튼을 보인다. 버튼은 명령을 클립보드에 복사하고 잠시 `복사됨` 으로 바뀐다. 복사에 실패하면 명령 텍스트를 선택 가능한 상태로 보여 준다. 출처가 없는 항목은 링크도 버튼도 없다.
15. 출처는 로컬에서 확인되는 것만 쓴다. 추정·웹 검색으로 채우지 않는다.
- Claude 플러그인. `~/.claude/plugins/known_marketplaces.json` 의 마켓 `source.repo`(github)이면 `https://github.com/<repo>`. 플러그인 plugin.json 에 `repository` 나 `homepage` 가 github 주소면 그것이 우선. 명령은 `/plugin marketplace add <repo>` 와 `/plugin install <이름>@<마켓>` 두 줄.
- Codex 플러그인. `~/.codex/config.toml` 의 `[marketplaces.<마켓>]` 중 `source_type = "git"` 의 `source`. 로컬 경로 마켓은 링크 없음. 명령은 `codex plugin marketplace add <github owner/repo>` 와 `codex plugin add <이름>@<마켓>` 두 줄.
- Grok 플러그인. `registry.json` 의 `kind.url`. 설치 명령은 Grok CLI 문서나 `~/.grok/docs` 에서 확인되는 경우만 넣고, 확인되지 않으면 링크만 둔다.
- 스킬. `~/.agents/.skill-lock.json` 에 같은 이름이 있으면 `sourceUrl` 을 링크로, 명령은 `npx skills add <source> --skill <이름>`. 도구 폴더가 그 스킬을 심볼릭 링크로 공유하는 경우 네 도구 모두 같은 출처가 붙는다. 락 파일에 없는 직접 만든 스킬과 번들 스킬은 출처 없음.
- 링크는 `https://github.com/` 로 시작하고 `.git` 접미사는 뗀다. 토큰이나 자격 증명이 든 URL(`user:pass@`)은 버린다.
16. 출처(`repoUrl`)가 없는 스킬 중 번들이 아닌 것(직접 만든 스킬, 락 파일에 없는 스킬)은 `ZIP 다운로드` 버튼을 둔다. 출처가 있는 항목은 명령 복사만 하고 ZIP 은 만들지 않는다. 번들 스킬과 플러그인은 ZIP 대상이 아니다.
17. ZIP 은 `scan-installed-tools.mjs --upload` 일 때만 만든다. 옵션이 없으면 스냅샷만 갱신하고 업로드하지 않는다. 업로드 전에 대상 개수와 총 용량을 출력한다. 환경변수 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 가 없으면 업로드를 건너뛰고 이유를 출력한다. 버킷이 없으면 비공개로 만든다.
18. ZIP 은 Supabase Storage 비공개 버킷 `installed-tools` 에 둔다. 경로는 `<도구id>/<이름>.zip`. 심볼릭 링크로 같은 폴더를 가리키는 스킬은 realpath 가 같으면 한 번만 올리고 모든 도구가 같은 객체를 가리킨다(경로는 첫 도구 기준). 버킷은 공개하지 않는다.
19. 다운로드는 로그인한 사용자만 한다. `GET /api/installed-tools/download?key=<경로>` 가 `requireUser()` 로 확인하고, 스냅샷에 있는 키인지 검증한 뒤(경로 조작 차단), 서비스 롤로 60초짜리 서명 URL 을 만들어 302 로 보낸다. 스냅샷에 없는 키와 `..` 가 든 키는 404 다.
20. ZIP 에서 제외하는 파일. `.git`, `node_modules`, `.DS_Store`, `.env*`, `*.pem`, `*.key`, 이름에 `credential`·`secret`·`token`·`id_rsa` 가 든 파일, 파일 1개 1MB 초과. 스킬 하나의 압축 전 합계가 5MB 를 넘으면 그 스킬은 ZIP 을 만들지 않는다. 제외한 파일 수와 건너뛴 스킬 목록을 출력한다. 심볼릭 링크 파일은 따라가지 않고 건너뛴다.
21. 스냅샷 항목에 `zipKey`(업로드된 경우만)가 붙는다. 버튼은 `zipKey` 가 있을 때만 보인다. ZIP 이 없는 직접 만든 스킬은 버튼 대신 아무것도 보이지 않는다.
22. 저장소가 공개이므로 ZIP 과 업로드 자격 증명은 git 에 들어가지 않는다. 스크립트는 ZIP 을 임시 폴더에서 만들고 업로드 뒤 지운다.
23. 검색창 옆에 정렬 선택이 있다. 선택지는 `이름순`(기본), `많이 쓴 순`, `출처 있는 순`이다. 현재 탭의 스킬·플러그인 두 구역에 같이 적용한다. 같은 값이면 이름순으로 정한다. `많이 쓴 순`은 사용 횟수 내림차순, `출처 있는 순`은 GitHub 링크가 있는 항목을 앞에 둔다. 탭을 바꾸면 정렬은 유지하고 검색어는 비운다. 정렬 선택은 키보드로 조작되고 라벨이 있다.
24. 설치 현황 상단에 `동기화` 버튼과 마지막 동기화 시각(`generatedAt`, 한국 시간)이 있다. 누르면 이 머신의 설치 상태를 다시 읽어 목록과 ZIP 을 갱신한다. 진행 중에는 버튼이 비활성이고 `동기화 중…` 을 보인다. 끝나면 `스킬 N · 플러그인 N 갱신, ZIP N개 업로드` 를 보이고 목록을 새로 불러온다. 실패하면 이유를 한국어로 보인다.
25. 동기화는 `POST /api/installed-tools/sync` 이다. `requireUser()` 로 로그인을 확인한다. 이 머신의 홈 디렉터리를 읽어야 하므로 로컬에서 실행한 앱에서만 동작한다. 배포 환경(`VERCEL` 환경변수가 있거나 `~/.claude` 가 없는 경우)에서는 501 과 `로컬에서 실행한 앱에서만 동기화할 수 있습니다` 를 준다. 이때 버튼은 눌러도 이 안내만 보이면 된다. 동시에 한 번만 돈다. 이미 도는 중이면 409.
26. 라우트는 고정 인자로 `node scripts/scan-installed-tools.mjs --sync` 를 자식 프로세스로 실행한다. 요청 값은 인자에 넣지 않는다. 제한 시간 3분. 표준 출력의 요약 줄에서 개수를 뽑아 응답한다. 표준 출력·오류 전문과 경로는 응답에 넣지 않는다.
27. `--sync` 는 `--upload` 의 동작(ZIP 업로드)에 더해 스냅샷 JSON 을 Supabase Storage 비공개 버킷 `installed-tools` 의 `snapshot.json` 으로 올리고(`upsert`), 로컬 `src/data/installed-tools.json` 도 갱신한다. `--sync` 도 업로드 전 개수·용량을 출력한다.
28. 페이지와 다운로드 라우트의 데이터 원본은 Storage 의 `snapshot.json` 이다. 읽기에 실패하거나 없으면 정적 `installed-tools.json` 으로 돌아간다. 둘 다 있으면 `generatedAt` 이 더 나중인 쪽을 쓴다. 서명 URL 허용 키 검증도 같은 원본의 zipKey 집합을 쓴다. 한글 번역 병합은 원본과 상관없이 동일하게 한다.
29. 동기화 뒤 바로 반영되도록 캐시를 쓰지 않거나, 쓴다면 동기화 성공 시 무효화한다.
30. 스킬·플러그인 카드에 용도 칩이 1~2개 붙는다. 이름과 설명을 읽고 정한 분류이며 고정 목록에서만 고른다. 목록은 `개발`, `디자인·UI`, `문서·글쓰기`, `마케팅·SEO`, `데이터·DB`, `클라우드·배포`, `브라우저·자동화`, `에이전트·워크플로`, `이미지·영상`, `음악·오디오`, `보안·검수`, `그누보드·쇼핑몰`, `연동·커넥터`, `기타` 이다. 설명이 비어 있으면 이름과 포함 정보로 판단하고, 정말 알 수 없으면 `기타` 이다.
31. 분류는 `src/data/installed-tools-tags.json` 에 따로 둔다. 키는 번역 파일과 같은 규칙(`도구id/skill|plugin/이름`, 이름 겹침은 `/출처` 접미사)이고 값은 칩 문자열 배열(최대 2개)이다. 같은 스킬이 여러 도구에 공유되면 같은 분류를 쓴다. 스캔 스크립트는 이 파일을 읽기만 하며, 끝에 `분류 누락 N개` 를 출력한다. 로더가 합쳐 `tags` 를 채운다.
32. 칩은 기존 출처 배지·`자주 N회` 배지·amber 강조와 구분되는 중립 색의 작은 칩이다. 카드 설명 아래에 줄바꿈되며 라이트·다크 대비를 지킨다. 칩은 읽기 전용이다(클릭 동작 없음). 칩 텍스트는 검색에도 포함된다.

## Design
스냅샷 형태.
`{ generatedAt, tools: [{ id, label, skills: [{name, description, source, uses}], plugins: [{name, version, marketplace, description, skillCount, uses}] }] }`
각 스킬·플러그인에 선택 필드 `repoUrl`(문자열), `installCommands`(문자열 배열), `zipKey`(문자열)가 붙는다.

스캔 규칙.
- Claude 스킬은 `~/.claude/skills/*/SKILL.md`. 심볼릭 링크가 `~/.agents/skills` 를 가리키면 source 는 `shared`, 아니면 `user`.
- Claude 플러그인은 `~/.claude/plugins/installed_plugins.json`. 설명과 skillCount 는 installPath 의 `.claude-plugin/plugin.json` 과 `skills/` 에서 읽는다.
- Codex 스킬은 `~/.codex/skills/*/SKILL.md`(점으로 시작하는 폴더 제외). 플러그인은 `~/.codex/config.toml` 의 `[plugins."이름@마켓"]` 중 `enabled = true` 인 것. 설명은 `~/.codex/plugins/cache/<마켓>/<이름>/*/` 의 plugin.json 에서 찾고 없으면 빈 문자열.
- Grok 스킬은 `~/.grok/skills/*`, 번들 스킬은 `~/.grok/bundled/skills/*` 로 source `bundled`. 플러그인은 `~/.grok/installed-plugins/registry.json` 의 `repos.*.plugins` 와 `marketplace.source_display_name`.
- Gemini 스킬은 `~/.gemini/skills/*/SKILL.md`. 플러그인은 없으면 빈 배열.
- 스냅샷 기본 순서는 가나다·알파벳 순이다. 화면 정렬은 클라이언트에서 한다.

경계. 새 DB 테이블·API 없음. 서버 컴포넌트가 JSON 을 읽어 클라이언트 목록에 props 로 넘긴다.

## Decisions
많이 쓴 기준. 3회 이상. 기록이 짧아 분포가 작고(최다 10회 안팎) 1~2회까지 강조하면 구분이 사라진다. 상수 하나로 둔다.
저장 방식. 정적 JSON. 설치 상태가 이 머신에만 있고 목록이 수백 건이라 DB 가 필요 없다.
통합 검색·대시보드. 넣지 않는다. 필요하면 후속 작업.
`~/.agents/skills` 는 별도 탭이 아니다. 다른 도구가 심볼릭 링크로 공유하는 원본이다.

번역 파일 갱신. 새로 설치된 항목은 한글이 없으면 영어만 보인다. 번역 누락 목록은 스캔 스크립트 끝에서 개수로 출력한다.

## Conflicts
기존 `/skills` 메뉴는 heyjames 카탈로그다. 이름 충돌을 피하려고 새 메뉴는 `설치 현황` 으로 부른다.

## Acceptance
사이드바에 설치 현황이 있다.
네 탭이 각각 스킬과 플러그인을 따로 보여 준다.
검색이 현재 탭에서 동작한다.
스냅샷 JSON 에 `/Users/` 경로와 토큰이 없다.
스캔 스크립트를 다시 돌리면 JSON 이 갱신된다.
