# Spec: 카피 본문 중복 등록 금지
Source: intent.md (Status: draft)

## Requirements
1. 같은 사용자의 카피 본문이 정규화 후 같으면 `POST /api/copies`는 201이 아니라 409다.
2. 응답 JSON은 `error`(이미 등록된 카피입니다), `duplicate: true`, `id`(기존 행)를 가진다.
3. 줄바꿈만 CRLF/CR vs LF이거나 앞뒤 공백만 다른 본문은 같은 글로 본다. 내부 공백·내용은 그대로 비교한다.
4. 작성 폼은 409 메시지를 빨간 안내로 보여 주고 입력값은 지우지 않는다.
5. 다른 사용자 본문과는 비교하지 않는다.
6. `PATCH /api/copies/[id]`로 본문을 바꿀 때도 자기 자신을 제외하고 같은 본문이 있으면 409다. 본문을 안 바꾸면 검사하지 않는다.

## Design
정규화는 `normalizeCopyBody` 한곳. CRLF·CR을 LF로 바꾸고 trim한다.
조회는 `findThreadCopyByBody(userId, body)`. 본문을 URL 필터에 넣지 않는다. SQLite는 바인딩, Supabase는 `id, body`만 페이지로 읽어 JS에서 비교한다.
목록 `COPY_LIST_SELECT`에서 body를 다시 넣지 않는다.

## Decisions
PATCH도 막는다. 등록만 막으면 수정으로 같은 글이 두 개가 된다.
body 해시 컬럼·UNIQUE 인덱스는 쓰지 않는다. 본문 상한 20KB가 Postgres btree 한도를 넘는다.

## Conflicts
없음.

## Acceptance
같은 본문을 두 번 추가하면 한 건만 남고 폼에 이미 등록됐다는 안내가 보인다.
CRLF만 다른 붙여넣기도 막힌다.
다른 본문은 그대로 추가된다.
수정에서 다른 카피 본문으로 바꾸면 저장되지 않는다.
