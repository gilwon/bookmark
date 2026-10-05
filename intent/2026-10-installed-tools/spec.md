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

## Design
스냅샷 형태.
`{ generatedAt, tools: [{ id, label, skills: [{name, description, source}], plugins: [{name, version, marketplace, description, skillCount}] }] }`

스캔 규칙.
- Claude 스킬은 `~/.claude/skills/*/SKILL.md`. 심볼릭 링크가 `~/.agents/skills` 를 가리키면 source 는 `shared`, 아니면 `user`.
- Claude 플러그인은 `~/.claude/plugins/installed_plugins.json`. 설명과 skillCount 는 installPath 의 `.claude-plugin/plugin.json` 과 `skills/` 에서 읽는다.
- Codex 스킬은 `~/.codex/skills/*/SKILL.md`(점으로 시작하는 폴더 제외). 플러그인은 `~/.codex/config.toml` 의 `[plugins."이름@마켓"]` 중 `enabled = true` 인 것. 설명은 `~/.codex/plugins/cache/<마켓>/<이름>/*/` 의 plugin.json 에서 찾고 없으면 빈 문자열.
- Grok 스킬은 `~/.grok/skills/*`, 번들 스킬은 `~/.grok/bundled/skills/*` 로 source `bundled`. 플러그인은 `~/.grok/installed-plugins/registry.json` 의 `repos.*.plugins` 와 `marketplace.source_display_name`.
- Gemini 스킬은 `~/.gemini/skills/*/SKILL.md`. 플러그인은 없으면 빈 배열.
- 이름 정렬은 가나다·알파벳 순.

경계. 새 DB 테이블·API 없음. 서버 컴포넌트가 JSON 을 읽어 클라이언트 목록에 props 로 넘긴다.

## Decisions
저장 방식. 정적 JSON. 설치 상태가 이 머신에만 있고 목록이 수백 건이라 DB 가 필요 없다.
통합 검색·대시보드. 넣지 않는다. 필요하면 후속 작업.
`~/.agents/skills` 는 별도 탭이 아니다. 다른 도구가 심볼릭 링크로 공유하는 원본이다.

## Conflicts
기존 `/skills` 메뉴는 heyjames 카탈로그다. 이름 충돌을 피하려고 새 메뉴는 `설치 현황` 으로 부른다.

## Acceptance
사이드바에 설치 현황이 있다.
네 탭이 각각 스킬과 플러그인을 따로 보여 준다.
검색이 현재 탭에서 동작한다.
스냅샷 JSON 에 `/Users/` 경로와 토큰이 없다.
스캔 스크립트를 다시 돌리면 JSON 이 갱신된다.
