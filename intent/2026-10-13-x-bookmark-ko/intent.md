# Intent: X 북마크 한글 번역
Author: gilwon, 사용자. Status: done.

## Problem
X북마크 목록의 게시 본문 상당수가 영어, 일본어, 스페인어다. 한글이 없어 목록에서 바로 읽기 어렵다.

## Proposed outcome
한글이 없는 본문 아래에 한국어 번역이 보인다. 원문 본문은 남는다. 이미 한글이 있는 게시는 바꾸지 않는다. 다시 동기화해도 같은 번역이 유지된다.

## Affected users and systems
이 앱의 X북마크 화면과 `x_bookmarks` 저장. 운영 데이터와 로컬 목록이 같은 규칙을 쓴다.

## Constraints
원문을 번역으로 갈아끼우지 않는다. 없는 문장을 지어 채우지 않는다. 잘린 원문은 보이는 데까지만 옮긴다. 공식 X API로 본문을 다시 받아도 번역 표를 다시 붙인다.

## Open questions
없음.
