# Plan: 카피 본문 중복 등록 금지

1. `src/lib/thread-copy.ts`에 `normalizeCopyBody`와 `copyBodiesMatch`를 둔다.
2. sqlite-store·supabase-store에 `findThreadCopyByBody(userId, body)`를 추가한다. 없으면 undefined. 목록 select에 body를 넣지 않는다.
3. `POST /api/copies` insert 전에 조회하고 있으면 409.
4. `PATCH /api/copies/[id]`는 본문이 바뀔 때만 자기 id를 제외하고 같은 본문이 있으면 409.
5. 작성 폼은 실패 시 입력을 유지한다. 409 문구는 API `error`를 쓴다.
6. `tests/thread-copy.test.mjs`에 정규화·비교 테스트를 추가한다.

완료. `node --test --import tsx tests/thread-copy.test.mjs` 통과. 브라우저에서 같은 본문 두 번 추가가 거절되는지 확인.
