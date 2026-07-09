# Supabase JS 연동 (방식 B)

앱은 **직접 Postgres 연결(`DATABASE_URL`)을 쓰지 않습니다.**  
서버에서 `@supabase/supabase-js` + **service_role** 로 PostgREST API를 호출합니다.

| 환경 변수 | 동작 |
|-----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | **Supabase JS** |
| 미설정 | **로컬 SQLite** (`data/mymark.db`) |

---

## 1. Supabase 프로젝트

1. 프로젝트 생성
2. **SQL Editor** → `supabase/schema.sql` 전체 실행
3. **Project Settings → API**
   - Project URL
   - `service_role` **secret** key
   - `anon` public key (선택)

## 2. `.env.local`

```env
AUTH_SECRET=...
AUTH_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # 서버 전용
```

`DATABASE_URL` 은 **넣지 않아도 됩니다.**

## 3. 확인

```bash
npm run dev
```

로그:

```
[db] backend=supabase (Supabase JS)
```

## 4. 보안

- `SUPABASE_SERVICE_ROLE_KEY` 는 **서버 env 만** (Vercel Server Environment)
- 브라우저에 service_role 을 노출하지 않음
- 앱 코드에서 항상 `user_id` 필터

## 5. Auth

로그인/세션은 계속 **Auth.js** (GitHub / Dev Login) 입니다.  
Supabase Auth 로 바꾸지 않았습니다.  
`user_id` 컬럼 = Auth.js `session.user.id`.
