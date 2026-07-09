# Supabase 연동 가이드 (MyMark)

앱은 **환경 변수**에 따라 DB 드라이버를 고릅니다.

| 조건 | 드라이버 |
|------|----------|
| `DATABASE_URL` (또는 `SUPABASE_DB_URL`) 이 `postgres://` / `postgresql://` | **Supabase Postgres** |
| 미설정 | **로컬 SQLite** (`data/mymark.db`) |

서버 API는 Auth.js 세션의 `user.id` 로 `user_id` 를 필터합니다.  
Postgres 접속은 연결 문자열(보통 service 권한)을 쓰므로 RLS 를 우회합니다.

---

## 1. Supabase 프로젝트 준비

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. **Project Settings → Database**
   - **Connection string → URI** 복사  
   - 권장: **Transaction pooler** (포트 `6543`, `?pgbouncer=true` 포함되는 경우 그대로)
   - 비밀번호에 특수문자가 있으면 URL 인코딩
3. **Project Settings → API**
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 절대 클라이언트 노출 금지)
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (선택)

## 2. 스키마 적용

Supabase Dashboard → **SQL Editor** → `supabase/schema.sql` 전체 실행.

테이블:

- `bookmarks`, `github_stars`, `custom_pages`, `oauth_tokens`, `agent_docs`

## 3. 로컬 `.env.local`

```bash
cp .env.example .env.local
```

```env
AUTH_SECRET=랜덤긴문자열
AUTH_URL=http://localhost:3000
GITHUB_ID=
GITHUB_SECRET=

# Supabase Postgres (이 값이 있으면 SQLite 대신 Postgres 사용)
DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 4. 실행 확인

```bash
npm run dev
```

터미널에 다음이 보이면 Postgres 연결입니다.

```
[db] driver=postgres (Supabase/Postgres)
```

SQLite 이면:

```
[db] driver=sqlite (local SQLite)
```

## 5. 로컬 SQLite 데이터 이전 (선택)

1. Dev Login / GitHub 로 앱을 쓰며 Postgres 에 새로 쌓아도 됩니다.
2. 기존 `data/mymark.db` 이전이 필요하면:
   - SQLite 에서 JSON export 후 import API/스크립트로 넣기
   - `oauth_tokens` 는 이전하지 말고 **GitHub 재로그인** 권장

## 6. Vercel 배포

Environment Variables 에 위 키를 동일하게 넣고,

- `AUTH_URL=https://your-domain.vercel.app`
- GitHub OAuth Callback 에 프로덕션 URL 추가

## 7. 보안 체크

- [ ] `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL` 이 클라이언트 번들에 없음
- [ ] 다른 사용자 `user_id` 행이 API 로 안 읽힘
- [ ] GitHub Star 동기화 후 본인 데이터만 보임
