# Intent: 신영선 자료 아카이브 메뉴
Author: 길원 (MyMark 사용자). Status: draft.

## Problem
https://yeongseon.kr/archive.html 의 자료 목록을 앱 안에서 같은 순서로 찾아볼 메뉴가 없다.

## Proposed outcome
사이드바 프롬프트 섹션에 메뉴 하나를 추가한다. 그 화면은 아카이브 목록 412편을 원문과 같은 필드와 순서로 보여 준다. 카드는 원문 글 주소로 연다.

## Affected users and systems
앱 사용자 본인. 사이드바, 커맨드 팔레트, 새 목록 화면.

## Constraints
- 목록 데이터는 2026-10-28에 받은 `ITEMS` 412건이다. 제목, 요약, 주제, 과정, 공개일, 출처, 글 주소를 바꾸지 않는다.
- 뉴스레터·카카오 신청 영역은 넣지 않는다.
- 하단 탭 개수는 늘리지 않는다. 메뉴는 기존 프롬프트 섹션에 둔다.
- 이미 있는 페이지 본문 이관 행은 수정하지 않는다.

## Open questions
없음. 화면 필드와 필터는 spec에서 정했다.
