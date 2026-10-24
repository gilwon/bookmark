# Spec: 모바일 하단 대메뉴
Source: intent.md (Status: draft)

## Requirements
1. lg 미만 화면 하단에 041 기반 탭 바가 고정된다. lg 이상에서는 보이지 않는다.
2. 탭은 `navSections` 의 섹션 5개와 일대일이다. 라벨은 섹션 라벨이고 라벨이 없는 첫 섹션은 "홈"이다.
3. 탭을 누르면 그 섹션의 첫 항목 경로로 이동한다. 홈 `/dashboard`, 라이브러리 `/bookmarks`, X `/x-bookmarks`, GitHub `/stars`, 프롬프트 `/prompts`.
4. 현재 경로가 섹션의 어느 항목(하위 경로 포함)과 맞으면 그 탭이 선택된다. 어느 섹션에도 없는 경로(예: `/installed-tools`는 라이브러리 섹션에 있음, `/search`는 홈 섹션)는 해당 섹션 탭이, 정말 없으면 선택 없음이 아니라 마지막 선택을 유지한다.
5. 선택 탭이 바뀌면 동그란 버튼과 파인 홈이 스프링으로 미끄러진다. 첫 렌더에는 애니메이션 없이 제자리에 놓인다.
6. 키보드. 좌우 방향키로 탭 사이 포커스가 이동하고 Enter 로 이동한다. 선택 탭만 tabIndex 0 이다(roving).
7. 탭 바는 `<nav aria-label="하단 메뉴">` 이고 탭은 `<Link>` 이며 선택 탭에 `aria-current="page"` 가 있다. 041 의 데모용 알림 배지는 넣지 않는다.
8. `AppShell` 의 본문은 모바일에서 하단 바 높이와 `env(safe-area-inset-bottom)` 만큼 아래 여백을 가진다. 탭 바도 같은 안전 영역을 띄운다.
9. prefers-reduced-motion 이면 스프링 없이 즉시 이동한다. 375px 에서 가로 스크롤이 없다.
10. 탭 바 코드 첫 줄에 041 라이선스 주석이 있다.

## Design
- `src/components/layout/bottom-nav.tsx` (신규, 클라이언트)와 `src/components/layout/lucian-041.css` (신규, `.u041` 범위).
- `sidebar.tsx` 의 `navSections` 앞에 `export` 만 붙여 재사용한다. 항목을 복사해 두 곳에서 관리하지 않는다.
- 아이콘은 사이드바와 같은 lucide 아이콘을 쓴다(홈 LayoutDashboard, 라이브러리 Bookmark, X BookmarkCheck, GitHub GitFork, 프롬프트 MessageSquareText). 041 의 CSS 가 svg 선 굵기를 지정하므로 모양은 맞는다.
- 041 의 고정 폭 350px 은 `width:100%` 로 바꾼다(좌우 12px 여백). 바 높이 84px, 솟은 원 62px, 모션 값은 그대로다. 이 변경은 보고한다.
- 스프링 위치 `--x` 는 원본처럼 rAF 로 움직이되, 선택은 클릭이 아니라 경로(`usePathname`)에서 정한다. 언마운트 시 rAF 를 취소한다.
- `AppShell` 에서 `<BottomNav />` 를 렌더하고 `main` 에 `pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-0` 을 준다.

## Decisions
- 탭 5개는 섹션 5개로 한다. 041 이 5탭이고 섹션도 5개라서 항목을 고르는 임의 기준이 필요 없다.
- 배지는 뺀다. 앱에 알림 개념이 없다.
- 하단 바 위에 뜨는 토스트(PWA 설치 토스트, 새 토스트)의 위치 조정은 이 작업 범위가 아니다. 겹치면 보고만 한다.

## Conflicts
- 041 의 선택 상태는 클릭으로 정하지만 여기서는 경로로 정한다. 같은 모양이고 데이터 출처만 다르다.
- 요구사항 4 의 "정말 없으면 마지막 선택 유지"는 `/search` 처럼 섹션에 있는 경로는 문제가 없고, 섹션 밖 경로가 생길 때만 쓰는 방어 동작이다.

## Acceptance
- 모바일 폭에서 모든 앱 화면 하단에 탭 바가 보이고 본문 끝이 가려지지 않는다.
- 탭을 누르면 해당 섹션으로 이동하고 원이 미끄러진다. 뒤로 가기로 돌아와도 맞는 탭이 선택된다.
- 데스크톱 폭에서는 하단 바가 없다.
- 라이트와 다크에서 읽힌다.
- `npx tsc --noEmit` 에 새 오류가 없다.
