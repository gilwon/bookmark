# Spec: 심팀장 자료실 메뉴
Source: intent.md (Status: draft)

## Requirements
1. 사이드바 프롬프트 섹션과 ⌘K 팔레트에 메뉴 「심팀장 자료실」이 있고, 경로 `/shim-guides`로 간다.
2. 목록은 https://shimteamjjang.vercel.app/ 의 `a.card` 52건을 문서 순서 그대로 보여 준다. 각 항목은 편수, 카드 제목(`.t`), 요약(`.d`의 텍스트)을 가진다.
3. 첫 항목은 `/rea`(64편), 마지막은 `/aicheatkey`(1편)이다. `/erase`의 편수는 「미게시」이다.
4. 목록 제목은 카드 제목이다. `/weekend`의 목록 제목은 「주말에 클로드로 만들어 볼 프로젝트 5개」이다.
5. 항목을 열면 `.wrap` 본문이 보인다. 헤더 캐릭터 이미지, 화면 제목, 문단, 표, 코드 펜스, 본문 링크, 본문 이미지, 바닥 글이 남는다.
6. 복사 버튼은 빠지고, 버튼이 붙어 있던 `pre` 글은 코드 펜스로 남는다.
7. 이미지는 data URL이 아니다. 절대 https 주소다. `/team.png`는 `https://shimteamjjang.vercel.app/team.png`이다. alt는 페이지에 적힌 그대로다. 48편은 「심팀장님 캐릭터」이고 plugin, token, design, convert 네 편은 「심팀장님과 막내」이다.
8. 슬래시로 시작하지 않는 이미지 주소는 그 글의 슬러그 폴더 기준이다. `/move`의 `s1_설정메모리.png`는 `https://shimteamjjang.vercel.app/move/s1_설정메모리.png`이다.
9. og 카드 이미지(`og-home.png`, `og-clone.png`, `og-reverse.png`, `og-weekend.png` 등)는 저장하지 않는다.
10. 링크의 추적 쿼리(`utm_*`, `fbclid`, `gclid`, `pvs`, `igsh`, `mcp_token`, `source=copy_link`, `m=1`)는 빠진다. localhost가 아닌 http는 https가 된다.
11. 검색은 제목, 요약, 편수, 슬러그를 공백과 대소문자 없이 맞춘다. 빈 검색은 52건을 사이트 순서로 돌려준다. 검색은 원본 배열을 바꾸지 않는다.
12. 없는 슬러그는 상세에서 404다.
13. Pages와 Prompts 표에는 쓰지 않는다. 이미 있는 `/pages` 행은 갱신하지 않는다.

## Design
김스듴 가이드와 같은 정적 카탈로그다. 메타데이터는 `src/data/shim-guides.json`, 본문 마크다운은 `src/data/shim-guide-bodies.json`이다. 목록과 상세는 `src/app/(app)/shim-guides`에 둔다. 본문 HTML 렌더는 기존 `GuideBody`를 다시 쓴다. 추출 스크립트는 직접 실행할 때만 네트워크를 타고, 테스트는 내보낸 함수와 저장된 JSON만 본다. 모바일 하단 탭은 `navSections`를 그대로 쓰므로 프롬프트 탭이 이 경로를 포함한다.

## Decisions
- 메뉴로 넣은 이유. 사용자가 목록 전체를 메뉴 하나에 담으라고 했고, 같은 패턴이 `/sdk-guides`에 있다.
- 목록 제목은 카드 `.t`다. 화면 `h1`과 `<title>`은 본문에만 둔다. 주말 글은 목록과 화면 제목이 다르다.
- 이미지는 https로 둔다. 캐릭터 PNG를 52번 data URL로 넣으면 본문만 수 MB가 된다. 김스듴 가이드 본문도 이미지를 https로 둔다. 헤더 alt는 바꾸지 않는다. 네 편만 「심팀장님과 막내」다.
- 상대 이미지는 문서 URL의 마지막 조각을 바꾸지 않고 `/{slug}/`에 붙인다. `new URL("s1_설정메모리.png", "https://shimteamjjang.vercel.app/move")`는 루트로 가서 404다. 파일은 `/move/` 아래에 있다.
- 미게시 카드를 뺀다거나 Pages에 이미 있는 3건을 뺀다는 결정은 하지 않았다. 홈 카드 52건이 전부다.
- 통합 검색 API에는 넣지 않는다. intent에 없다.

## Conflicts
없음. 기존 Pages에 있는 weekend, reverse, clone은 행을 고치지 않고 카탈로그에만 다시 싣는다.

## Acceptance
- 사이드바와 ⌘K에 「심팀장 자료실」이 있고 `/shim-guides`가 열린다.
- 목록에 52건이 사이트 순서로 있고, 검색으로 제목이 걸러진다.
- `/shim-guides/weekend`에 캐릭터 이미지, 표, 코드 펜스, 바닥 글이 있고 복사 버튼 글자만 있는 줄은 없다.
- `/shim-guides/rug`와 `/shim-guides/move`의 추가 이미지가 깨지지 않는 https 주소다.
- `/shim-guides/erase`가 보인다.
- `custom_pages`와 prompts는 이번 작업으로 늘거나 바뀌지 않는다.
