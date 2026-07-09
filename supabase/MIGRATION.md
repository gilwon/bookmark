# Supabase 이전 가이드

현재 MVP는 **로컬 SQLite (Drizzle + better-sqlite3)** 입니다.  
프로덕션에서 Supabase Postgres로 옮길 때 이 문서를 따릅니다.

## 1. 스키마 적용

Supabase SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.

- 테이블: `bookmarks`, `github_stars`, `custom_pages`, `oauth_tokens`
- **RLS** 활성 + 본인 `user_id` 정책
- `oauth_tokens` 는 클라이언트 정책 deny (서버 `service_role` 만)

## 2. 환경 변수

```env
# 기존 Auth.js
AUTH_SECRET=
AUTH_URL=https://your-app.vercel.app
GITHUB_ID=
GITHUB_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # 서버 전용, 절대 클라이언트 노출 금지
```

## 3. 앱 어댑터 방향

1. `src/lib/db` 를 Postgres(Drizzle `postgres-js` 또는 Supabase client)로 교체
2. **서버 API 라우트**는 `service_role` 또는 사용자 JWT를 전달해 RLS 통과
3. `oauth_tokens` 읽기/쓰기는 **service_role 전용** 유지 (세션에 토큰 금지 — 이미 구현된 패턴)
4. Auth.js `user.id` (= JWT `sub`) 를 모든 `user_id` 컬럼에 그대로 사용

## 4. 데이터 이전

1. 로컬 `data/mymark.db` 를 export (JSON/SQL)
2. tags/topics JSON 배열 → Postgres `text[]`
3. content JSON 문자열 → `jsonb`
4. `oauth_tokens` 는 이전하지 말고 사용자 **재로그인** 유도 (키/암호 의존)

## 5. 검증 체크리스트

- [ ] 사용자 A의 북마크를 사용자 B 세션으로 GET/PATCH/DELETE 불가
- [ ] 브라우저 네트워크 탭에 access_token 없음
- [ ] service_role 키는 Vercel Server env 에만 존재
- [ ] Star 동기화 후 본인 행만 증가

## 6. 현재 코드가 이미 맞춘 것

- API 소유권 검사 (`user_id` AND 조건)
- GitHub 토큰 서버 암호 저장 (`oauth_tokens` + AES-GCM)
- 세션에 `hasGithub` / `githubLogin` 만 노출
