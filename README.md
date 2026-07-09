# MyMark — Personal Bookmark Hub

브라우저 북마크와 GitHub Star를 한곳에서 관리하는 개인 지식 허브 MVP입니다.

## 기능

- **북마크**: URL 저장 시 OG 메타 자동 추출, 태그·카테고리
- **GitHub Stars**: OAuth 로그인 후 Star 동기화, 언어/검색 필터, unstar 정리
- **커스텀 페이지**: Tiptap 에디터 + 북마크/Star 임베드
- **에이전트 문서**: SKILL.md / AGENTS.md / CLAUDE.md Markdown 보관·편집·내보내기
- **통합 검색**: 북마크·Star·페이지·에이전트 문서 + 타입·카테고리·날짜 필터
- **다크/라이트 모드**, 반응형 사이드바(아바타·GitHub 프로필)

## 스택

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Auth.js (next-auth v5) — GitHub OAuth + 개발용 Dev Login
- 데이터: **Supabase JS** (`service_role`) 또는 로컬 SQLite
- open-graph-scraper, Octokit, Tiptap
- GitHub access_token은 **서버 DB 암호 저장** (세션 비노출)

## 시작하기

```bash
npm install
cp .env.example .env.local
# AUTH_SECRET, GITHUB_ID, GITHUB_SECRET 설정 권장
npm run dev
```

[http://localhost:3000](http://localhost:3000)

### GitHub OAuth

1. GitHub → Settings → Developer settings → OAuth Apps
2. Callback URL: `http://localhost:3000/api/auth/callback/github`
3. `.env.local`에 `GITHUB_ID`, `GITHUB_SECRET`, `AUTH_SECRET`, `AUTH_URL` 설정
4. 로그인 후 **GitHub Stars** 페이지에서 자동/수동 동기화

### Dev Login

- 개발 환경에서만 기본 활성 (`ENABLE_DEV_LOGIN`으로 제어)
- email: `dev@local` / password: `dev`
- Star 동기화 불가 (OAuth 토큰 없음)

### DB / Supabase (방식 B — JS 클라이언트)

- **기본(로컬)**: SQLite (`data/mymark.db`)  
  → `[db] backend=sqlite`
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`  
  → `DATABASE_URL` **불필요** (PostgREST API 사용)  
  → SQL: `supabase/schema.sql`  
  → 가이드: [`supabase/MIGRATION.md`](./supabase/MIGRATION.md)  
  → `[db] backend=supabase (Supabase JS)`

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `AUTH_SECRET` | 프로덕션 필수 | Auth.js + 토큰 암호 키 유도 |
| `GITHUB_ID` | Star 연동 시 | OAuth Client ID |
| `GITHUB_SECRET` | Star 연동 시 | OAuth Client Secret |
| `AUTH_URL` | 권장 | 예: `http://localhost:3000` |
| `ENABLE_DEV_LOGIN` | 선택 | `true`/`false` — 프로덕션 Dev Login |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 모드 | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 모드 | 서버 전용 secret (절대 클라이언트 노출 금지) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 선택 | 공개 anon key (현재 앱 서버 경로는 service_role 사용) |

## 보안 메모

- 클라이언트 세션에 `accessToken`을 넣지 않습니다 (`hasGithub`, `githubLogin`만).
- API 변경/삭제는 항상 `id + user_id` 소유권 조건.
- Supabase 이전 시 `oauth_tokens`는 service_role 전용 (RLS deny all).
