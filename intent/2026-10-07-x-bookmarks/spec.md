# Spec: X 북마크 메뉴
Source: intent.md (Status: draft). 사용자는 이 방향으로 구현하라고 했다.

## Requirements
1. 사이드바 라이브러리와 GitHub 사이에 X 섹션이 있고, 항목 이름은 X북마크이며 경로는 `/x-bookmarks`이다. 명령 팔레트에서도 같은 화면으로 이동한다.
2. 화면은 저장된 X 북마크를 작성자 이름, 사용자 이름, 게시 시각, 본문, `https://x.com/.../status/...` 링크와 함께 보여 준다.
3. X 연결은 현재 앱 사용자에게 붙는 별도 OAuth 2.0 PKCE다. 범위는 `bookmark.read`, `tweet.read`, `users.read`, `offline.access`이다. 앱 로그인 공급자는 GitHub와 Dev Login 그대로다.
4. 동기화는 `GET /2/users/:id/bookmarks`만 호출하고, 페이지를 따라 공식 응답이 끝나는 곳까지 읽는다. 한 번에 최대 100개, 안전 상한 10페이지다.
5. 같은 사용자와 게시 ID는 한 행이다. 이번 응답에 없는 기존 행은 지우지 않는다.
6. `X_CLIENT_ID` 또는 `X_CLIENT_SECRET`이 없으면 화면은 열리고, 키와 콜백 주소 `{origin}/api/x/callback`을 안내한다. 연결 버튼은 키가 있을 때만 동작한다.
7. 액세스 토큰이 만료되면 저장한 리프레시 토큰으로 갱신한다. 갱신이나 조회가 401이면 저장된 X 토큰을 지우고 다시 연결하라고 보여 준다.
8. 토큰 원문은 화면에 나오지 않는다. 저장은 기존 oauth 토큰 암호화를 탄다.
9. 화면 안에서 본문, 작성자, 주소로 걸러 볼 수 있다.

## Design
X 북마크는 `x_bookmarks` 테이블에 둔다. 로컬 SQLite는 기동 시 테이블을 만들고, Supabase는 `supabase/add_x_bookmarks.sql`과 `schema.sql`에 같은 정의와 본인 행 RLS를 둔다. 앱은 service role로 읽고 쓴다.

연결 흐름은 `/api/x/connect`가 PKCE state와 verifier를 httpOnly 쿠키에 넣고 `https://x.com/i/oauth2/authorize`로 보낸다. `/api/x/callback`이 `https://api.x.com/2/oauth2/token`으로 코드를 바꾸고, provider `x`의 암호화 JSON에 access token, refresh token, 만료 시각, X 사용자 ID를 저장한 뒤 `/x-bookmarks`로 돌아온다. 해제는 `/api/x/disconnect`다. 동기화는 `POST /api/x-bookmarks/sync`다.

목록이 비어 있고 X가 연결돼 있으면 Star 화면처럼 한 번 자동 동기화한다. 주소는 사용자 이름이 있으면 `https://x.com/{username}/status/{id}`, 없으면 `https://x.com/i/status/{id}`다.

## Decisions
- 메뉴를 따로 둔다. 일반 북마크 테이블에 넣지 않는다. 사용자가 메뉴를 따로 만들라고 했다.
- 공식 API와 사용자 동의만 쓴다. 아카이브와 스크래핑은 쓰지 않는다.
- 개발자 키가 없어도 메뉴와 안내 화면은 동작한다. 키를 만들어 넣기 전에는 동기화하지 않는다.
- API가 최근 약 800개만 주므로, 응답에 없는 로컬 행은 보존한다. 그보다 오래된 항목은 이 버전에서 가져오지 않는다.
- X를 Auth.js 로그인 공급자로 넣지 않는다. 현재 세션 사용자에게 토큰만 연결한다.
- 리프레시 토큰은 oauth_tokens 컬럼을 늘리지 않고, provider `x`의 암호화 문자열 안에 JSON으로 둔다. GitHub 토큰 형식은 그대로다.
- 즐겨찾기, 대시보드 집계, 통합 검색, 북마크 폴더 화면은 이번 요구에 없다.

## Conflicts
없음. intent Status는 draft이다. 사용자는 구현을 지시했다.

## Acceptance
- 사이드바 X북마크를 누르면 `/x-bookmarks`가 열린다.
- 키가 없으면 안내 문구와 콜백 주소가 보이고, 앱의 다른 메뉴는 그대로다.
- 키가 있고 X를 연결한 뒤 동기화하면 저장된 게시가 카드로 보이며, 링크가 X 게시로 열린다.
- 같은 게시 ID를 다시 동기화해도 행이 늘지 않고, 응답 밖의 기존 행은 남는다.
- 순수 함수 테스트가 주소 생성, 응답 매핑, 만료 판단을 통과한다.
