# MyMark — Personal Bookmark Hub

브라우저 북마크, GitHub Star, 메모 페이지, 에이전트 문서를 한곳에서 관리하는 개인 지식 허브입니다.

**저장소:** [github.com/gilwon/bookmark](https://github.com/gilwon/bookmark)

## 기능

| 영역 | 내용 |
|------|------|
| **북마크** | URL 저장 시 OG 메타 자동 추출, 태그·카테고리, 카드 그리드 |
| **HTML 가져오기** | 브라우저(Chrome/Firefox 등) 북마크 HTML export 업로드·일괄 등록 |
| **선택 삭제** | 북마크·Star·페이지·에이전트 문서 목록에서 전체 선택 / 선택 삭제 |
| **GitHub Stars** | OAuth 로그인 후 Star 동기화, 언어·검색 필터, unstar 로컬 정리 |
| **커스텀 페이지** | Tiptap 에디터 + 북마크/Star 임베드 블록 |
| **에이전트 문서** | SKILL / AGENTS / CLAUDE / other Markdown 보관·편집·복사·다운로드 |
| **스킬 업로드** | `.md`, `.zip`, `.skill`(ZIP) 드래그 앤 드롭 → 자동 해제·번들 저장 |
| **통합 검색** | 북마크·Star·페이지·에이전트 문서 + 타입·카테고리·날짜 필터 |
| **테마** | 다크/라이트 모드, 반응형 사이드바(아바타·GitHub 프로필) |

## 스택

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **Auth.js** (`next-auth` v5) — GitHub OAuth + 개발용 Dev Login
- **데이터 (방식 B)**
  - 기본: 로컬 **SQLite** (`data/mymark.db`, better-sqlite3 + Drizzle)
  - 선택: **Supabase JS** (`@supabase/supabase-js` + `service_role`, PostgREST)
  - 직접 Postgres 연결(`DATABASE_URL`)은 사용하지 않음
- **기타:** open-graph-scraper, Octokit, Tiptap, fflate (ZIP), Zod

데이터 접근은 `src/lib/store` 단일 진입점입니다.  
env에 Supabase URL + service_role 이 있으면 Supabase, 없으면 SQLite.

## 시작하기

```bash
npm install
cp .env.example .env.local
# AUTH_SECRET 권장. GitHub Star 쓰려면 GITHUB_ID / GITHUB_SECRET
npm run dev
```

[http://localhost:3000](http://localhost:3000)

로컬만 쓸 경우 별도 DB 설정 없이 바로 동작합니다.  
(Dev Login: `dev@local` / `dev`)

### GitHub OAuth

1. GitHub → **Settings → Developer settings → OAuth Apps**
2. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. `.env.local`에 설정

```env
AUTH_SECRET=랜덤문자열
AUTH_URL=http://localhost:3000
GITHUB_ID=...
GITHUB_SECRET=...
```

4. 로그인 후 **Stars** 페이지에서 자동/수동 동기화

### Dev Login

- 개발 환경에서 기본 활성 (`NODE_ENV !== "production"`)
- 프로덕션에서는 `ENABLE_DEV_LOGIN=true` 일 때만 활성
- email: `dev@local` / password: `dev`
- Star 동기화 불가 (OAuth 토큰 없음)

### Supabase (선택, 방식 B)

1. Supabase 프로젝트 생성
2. **SQL Editor**에서 [`supabase/schema.sql`](./supabase/schema.sql) 실행
3. `.env.local`에 추가

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # 서버 전용 — 절대 클라이언트/공개 저장소에 넣지 말 것
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # 선택
```

4. `npm run dev` 후 로그 확인

```
[db] backend=supabase (Supabase JS)
```

상세 가이드: [`supabase/MIGRATION.md`](./supabase/MIGRATION.md)

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `AUTH_SECRET` | 프로덕션 필수 | Auth.js + GitHub 토큰 암호 키 유도 |
| `AUTH_URL` | 권장 | 예: `http://localhost:3000` |
| `GITHUB_ID` | Star 연동 시 | OAuth Client ID |
| `GITHUB_SECRET` | Star 연동 시 | OAuth Client Secret |
| `ENABLE_DEV_LOGIN` | 선택 | `true`/`false` — 프로덕션 Dev Login |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 모드 | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 모드 | 서버 전용 secret |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 선택 | 공개 anon key (현재 서버 경로는 service_role 사용) |

`DATABASE_URL` 은 **사용하지 않습니다.**

## 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run start      # 빌드 결과 실행
npm run lint       # ESLint
npm run db:check   # 현재 백엔드 표시 (supabase-js | sqlite)
```

## 주요 경로

| 경로 | 설명 |
|------|------|
| `/bookmarks` | 북마크 목록·추가·HTML 가져오기 |
| `/stars` | GitHub Star 동기화·필터 |
| `/pages` | 커스텀 메모 페이지 |
| `/agent-docs` | 에이전트 문서 보관함 |
| `/search` | 통합 검색·필터 |
| `/login` | GitHub / Dev Login |

## 아키텍처 메모

```
API / Server Components
        │
        ▼
  src/lib/store          ← 단일 인터페이스
   ├─ supabase-store     ← service_role PostgREST
   └─ sqlite-store       ← better-sqlite3 + Drizzle
```

- 인증·세션: **Auth.js** (Supabase Auth 미사용)
- `user_id` = Auth.js `session.user.id`
- GitHub `access_token`은 서버 DB에 암호화 저장. 세션에는 `hasGithub`, `githubLogin`만
- API 변경/삭제는 항상 `id + user_id` 소유권 조건
- Supabase RLS: 테이블 정책 + `oauth_tokens` 는 service_role 전용

## 라이선스

Private / personal use.
