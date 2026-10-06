# Intent: X 북마크 메뉴
Author: gilwon, 사용자. Status: draft.

## Problem
X에 북마크한 게시가 이 앱에서 보이지 않는다. 공식 데이터 아카이브에도 북마크가 없고, 앱에는 X 연결이 없다.

## Proposed outcome
사이드바에 X북마크 메뉴가 생긴다. 그 화면에서 로그인한 사용자 본인의 X 북마크 목록을 본다. 각 항목에서 작성자, 본문, X 게시 링크를 확인할 수 있다.

## Affected users and systems
이 앱에 로그인하는 사용자. 이 앱의 메뉴와 저장소. X 계정의 비공개 북마크.

## Constraints
공식 X API로만 읽는다. 브라우저 스크래핑은 하지 않는다. 일반 북마크 목록과 섞지 않고 메뉴를 따로 둔다. GitHub Star 화면과 같은 톤을 유지한다. 앱의 GitHub 로그인 계정을 X 로그인으로 바꾸지 않는다.

## Open questions
- X 개발자 앱 키는 아직 이 저장소 환경에 없다.
- API가 돌려주는 최근 북마크보다 오래된 항목을 어떻게 볼지는 정해지지 않았다.
