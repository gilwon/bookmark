# Intent: 카피 본문 중복 등록 금지
Author: Advisor. Status: draft.

## Problem
같은 스레드 본문을 카피에 두 번 붙여 넣어도 그대로 저장된다. 목록에 같은 글이 쌓인다.

## Proposed outcome
이미 있는 본문과 같으면 새 행이 생기지 않는다. 화면에는 이미 등록됐다는 안내가 보인다.

## Affected users and systems
카피를 붙이는 사용자. `POST /api/copies`와 목록 상단 작성 폼. SQLite·Supabase `thread_copies`.

## Constraints
소유자 스코프만 본다. 다른 사용자와는 공유하지 않는다. 본문 내용은 바꾸지 않는다. 북마크처럼 이미 있으면 409다. 본문 20KB라 body 고유 인덱스는 쓰지 않는다.

## Open questions
수정(PATCH)으로 다른 카피와 같은 본문이 되는 것도 막을지.
