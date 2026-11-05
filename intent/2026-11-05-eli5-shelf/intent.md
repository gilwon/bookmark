# Intent: eli5 설명서 메뉴
Author: gilwon (요청자). Status: draft.

## Problem
claude.ai 아티팩트 "eli5 설명서 서가"에 모아 둔 레포 설명서(현재 49건)를 앱 안에서 보지 못한다. 서가는 외부 링크라 로그인 흐름과 분리돼 있다.

## Proposed outcome
사이드바 GitHub 묶음에 "eli5 설명서" 메뉴가 생긴다. 화면에서 검색하고, 설명/비교와 태그로 거르고, 카드를 누르면 넓은 패널 안에서 설명서 본문(탭, 복사 버튼 포함)이 그대로 동작한다.

## Affected users and systems
앱을 쓰는 본인. 정적 데이터 두 파일, 새 화면과 본문 라우트, 사이드바, 명령 팔레트, 갱신 스크립트. DB와 하단 탭은 건드리지 않는다.

## Constraints
스킬공유자료실과 같은 정적 파일 방식이다. 본문은 앱 원본과 분리된 sandbox iframe으로만 보여 주고 로그인한 사용자에게만 준다. 저장소가 공개라 본문 파일은 GitHub에 공개되며 요청자가 동의했다. 서가에서 제외한 두 문서("한 폴더 두 시스템", "Next.js vs TanStack")는 넣지 않는다.

## Open questions
없음. 세부 결정은 spec.md에 적는다.
