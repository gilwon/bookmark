# Intent: 모바일 하단 대메뉴
Author: 길원 (MyMark 사용자). Status: draft.

## Problem
모바일에서는 상단 바의 햄버거를 눌러 드로어를 열어야 다른 메뉴로 갈 수 있다. 자주 가는 대메뉴로 한 번에 이동할 수 없다.

## Proposed outcome
모바일 화면 하단에 대메뉴 탭 바가 항상 보인다. 탭은 Lucian UX/UI 041번(홈 파인 하단 탭 바) 요소를 쓴다. 현재 있는 섹션 5개(홈, 라이브러리, X, GitHub, 프롬프트)가 탭 5개가 된다. 현재 페이지가 속한 탭이 선택 상태로 보인다.

## Affected users and systems
앱 사용자 본인. `src/components/layout/` 의 AppShell 과 사이드바.

## Constraints
- 모바일(lg 미만)에서만 보인다. 데스크톱 레일은 그대로다.
- 041 코드는 `lucian-uxui` 스킬 `get` 결과만 쓰고 구조·모양·모션 값을 유지한다. 라이선스 주석을 지킨다.
- 상단 바와 드로어는 남긴다. 대메뉴에 없는 페이지는 드로어로 간다.
- 하단 바 때문에 본문 끝이 가려지지 않아야 한다. 아이폰 홈 인디케이터 영역을 피한다.

## Open questions
없음. 탭과 섹션의 대응은 spec 에서 정했다.
