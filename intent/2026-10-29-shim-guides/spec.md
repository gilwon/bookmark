# Spec: 심팀장 자료실 메뉴
Source: intent.md (Status: draft)

## Requirements
1. 사이드바 프롬프트 섹션과 ⌘K 팔레트에 메뉴 「심팀장 자료실」이 있고, 경로 `/shim-guides`로 간다.
2. 목록은 https://shimteamjjang.vercel.app/ 의 `a.card`를 문서 순서 그대로 보여 준다. 2026-10-29 최초 수집은 52건이었다. 그다음 대조에서 16건을 더해 68건이 되었다. 2026-11-06 대조에서 홈에만 있던 9건을 더해 목록은 77건이다. 이미 있는 제목, 편수, 요약, 본문은 유지한다.
3. 목록의 첫 항목은 `/gamestudio`(95편, 「게임 만드는 깃허브 5개 한 장 정리」)이고 마지막은 `/aicheatkey`(1편)이다. `/ruflo`는 80편으로 10번째다. `/rea`는 64편으로 남고 첫 항목이 아니다. `/erase`의 편수는 「미게시」이다. 이번 9건의 순서는 gamestudio, plugins25, trending, designskills, agents, cutedit, advisor, checkup, stageshow 이다. 그 다음 16건 순서는 ruflo, arena, timemachine, craftapps, hiddenskills, headroom, bigtech3, fivecodes, opendesign, stockai, freetoken, tvad, appsecurity, employees, watermark, playbook 이다.
4. 목록 제목은 카드 제목이다. `/weekend`의 목록 제목은 「주말에 클로드로 만들어 볼 프로젝트 5개」이다.
5. 항목을 열면 `.wrap` 본문이 보인다. 헤더 캐릭터 이미지, 화면 제목, 문단, 표, 코드 펜스, 본문 링크, 본문 이미지, 바닥 글이 남는다.
6. 복사 버튼은 빠지고, 버튼이 붙어 있던 `pre` 글은 코드 펜스로 남는다.
7. 이미지는 data URL이 아니다. 절대 https 주소다. `/team.png`는 `https://shimteamjjang.vercel.app/team.png`이다. alt는 페이지에 적힌 그대로다. 처음 52건 중 plugin, token, design, convert 네 편은 「심팀장님과 막내」이고 나머지 48편은 「심팀장님 캐릭터」이다. 나중에 추가하는 글의 alt도 그 페이지 문구를 바꾸지 않는다.
8. 슬래시로 시작하지 않는 이미지 주소는 그 글의 슬러그 폴더 기준이다. `/move`의 `s1_설정메모리.png`는 `https://shimteamjjang.vercel.app/move/s1_설정메모리.png`이다.
9. og 카드 이미지(`og-home.png`, `og-clone.png`, `og-reverse.png`, `og-weekend.png` 등)는 저장하지 않는다.
10. 링크의 추적 쿼리(`utm_*`, `fbclid`, `gclid`, `pvs`, `igsh`, `mcp_token`, `source=copy_link`, `m=1`)는 빠진다. localhost가 아닌 http는 https가 된다.
11. 검색은 제목, 요약, 편수, 슬러그를 공백과 대소문자 없이 맞춘다. 빈 검색은 카탈로그 전체를 사이트 순서로 돌려준다. 검색은 원본 배열을 바꾸지 않는다.
12. 없는 슬러그는 상세에서 404다.
13. Pages와 Prompts 표에는 쓰지 않는다. 이미 있는 `/pages` 행은 갱신하지 않는다.
14. 목록 화면에 「목록 동기화」 버튼이 있다. 서버 액션은 세션이 없으면 목록을 바꾸지 않는다.
15. 버튼을 누르면 홈 `a.card`를 다시 읽는다. 카탈로그에 없는 슬러그만 본문을 받아 문서 순서로 넣는다. 이미 있는 슬러그의 제목, 편수, 요약, 본문은 유지하고 `order`만 홈 순서로 다시 매긴다. 홈에 없는 로컬 슬러그는 지우지 않고 뒤에 둔다. 홈 카드가 0이면 파일을 쓰지 않는다. 다시 만든 목록과 본문이 디스크와 바이트 단위로 같으면 파일을 쓰지 않는다.
16. 동기화가 끝나면 목록은 디스크의 카탈로그를 다시 읽는다. 추가가 없으면 「이미 최신입니다.」 추가가 있으면 「N건을 추가했습니다.」 실패하면 「동기화에 실패했습니다.」 진행 중에는 버튼이 비활성이다.

## Design
김스듴 가이드와 같은 정적 카탈로그다. 메타데이터는 `src/data/shim-guides.json`, 본문 마크다운은 `src/data/shim-guide-bodies.json`이다. 목록과 상세는 `src/app/(app)/shim-guides`에 둔다. 본문 HTML 렌더는 기존 `GuideBody`를 다시 쓴다. 추출 스크립트는 직접 실행할 때만 네트워크를 타고, 테스트는 내보낸 함수와 저장된 JSON만 본다. 모바일 하단 탭은 `navSections`를 그대로 쓰므로 프롬프트 탭이 이 경로를 포함한다.

## Decisions
- 메뉴로 넣은 이유. 사용자가 목록 전체를 메뉴 하나에 담으라고 했고, 같은 패턴이 `/sdk-guides`에 있다.
- 목록 제목은 카드 `.t`다. 화면 `h1`과 `<title>`은 본문에만 둔다. 주말 글은 목록과 화면 제목이 다르다.
- 이미지는 https로 둔다. 캐릭터 PNG를 글마다 data URL로 넣으면 본문만 수 MB가 된다. 김스듴 가이드 본문도 이미지를 https로 둔다. 헤더 alt는 바꾸지 않는다. 처음 52건 중 네 편만 「심팀장님과 막내」다.
- 다시 추출할 때 이미 저장한 슬러그의 제목, 편수, 요약, 본문은 다시 받지 않는다. 홈에 새로 있는 슬러그만 받고, 순서는 홈 문서 순서로 다시 매긴다. 홈에서 빠진 슬러그는 지우지 않는다.
- 편수와 카드 수는 다르다. 홈의 가장 큰 편수가 97편이어도 카드가 77장이면 목록은 77건이다. 동기화는 편수가 아니라 `a.card`를 맞춘다.
- 동기화는 목록 화면의 서버 액션이다. 세션을 확인하고, 기존 추출 함수로 JSON 두 파일을 갱신한 뒤 목록과 상세가 그 파일을 다시 읽게 한다. 정적 import에 묶인 JSON은 프로세스가 켜진 동안 갱신되지 않는다.
- 배포 함수 디스크는 읽기 전용이다. 내용이 같은데 다시 쓰면 `EROFS`로 실패한다. 그래서 바이트가 같으면 쓰지 않는다. 본문 JSON이 함수에 없으면 저장된 글이 전부 새 글로 보이므로, `/shim-guides` 트레이스에 목록 JSON과 본문 JSON을 넣는다.
- 상대 이미지는 문서 URL의 마지막 조각을 바꾸지 않고 `/{slug}/`에 붙인다. `new URL("s1_설정메모리.png", "https://shimteamjjang.vercel.app/move")`는 루트로 가서 404다. 파일은 `/move/` 아래에 있다.
- 미게시 카드를 뺀다거나 Pages에 이미 있는 3건을 뺀다는 결정은 하지 않았다. 홈 카드를 빠짐없이 담는다.
- 통합 검색 API에는 넣지 않는다. intent에 없다.

## Conflicts
없음. 기존 Pages에 있는 weekend, reverse, clone은 행을 고치지 않고 카탈로그에만 다시 싣는다.

## Acceptance
- 사이드바와 ⌘K에 「심팀장 자료실」이 있고 `/shim-guides`가 열린다.
- 목록에 77건이 사이트 순서로 있고, 첫 항목은 `/gamestudio`이다. 검색으로 제목이 걸러진다.
- 기존 52건의 제목, 요약, 본문 문자열은 추가 전과 같다. `order`만 홈 순서에 맞춘다.
- `/shim-guides/weekend`에 캐릭터 이미지, 표, 코드 펜스, 바닥 글이 있고 복사 버튼 글자만 있는 줄은 없다.
- `/shim-guides/rug`와 `/shim-guides/move`의 추가 이미지가 깨지지 않는 https 주소다.
- `/shim-guides/erase`가 보인다.
- `custom_pages`와 prompts는 이번 작업으로 늘거나 바뀌지 않는다.
- 목록에 「목록 동기화」가 있고, 홈과 카탈로그가 같으면 「이미 최신입니다.」가 보이며 건수는 그대로다.
