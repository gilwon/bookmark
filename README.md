# MyMark — Personal Bookmark Hub

브라우저 북마크와 GitHub Star를 한곳에서 관리하는 개인 지식 허브 MVP입니다.

## 기능

- **북마크**: URL 저장 시 OG 메타(제목/설명/이미지/파비콘) 자동 추출, 태그·카테고리
- **GitHub Stars**: OAuth 로그인 후 Star 레포 동기화 (언어/스타 수/토픽)
- **커스텀 페이지**: Tiptap 리치 텍스트 에디터
- **통합 검색**: 제목/설명/URL/태그 + 타입·카테고리 필터
- **다크모드 기본**, 반응형 사이드바

## 스택

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Auth.js (next-auth v5) — GitHub OAuth + Dev Login
- Drizzle ORM + better-sqlite3 (`data/mymark.db`)
- open-graph-scraper, Octokit, Tiptap, next-themes

## 시작하기

```bash
# 의존성 (이미 설치된 경우 생략)
npm install

# 환경 변수
cp .env.example .env.local
# AUTH_SECRET, (선택) GITHUB_ID / GITHUB_SECRET 설정

# 개발 서버
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인합니다.

### Dev Login

`GITHUB_ID` 없이도 **Dev Login** 버튼으로 로컬 UI를 사용할 수 있습니다.

- email: `dev@local`
- password: `dev`

GitHub Star 동기화는 **GitHub OAuth 로그인**이 필요합니다.

### DB

SQLite 파일은 `data/mymark.db`에 자동 생성됩니다.

```bash
npm run db:push    # drizzle-kit push
npm run db:studio  # Drizzle Studio
```

Postgres(Supabase) 이전용 SQL은 `supabase/schema.sql`을 참고하세요.

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 |
| `npm run db:push` | 스키마 푸시 |
| `npm run db:studio` | DB 스튜디오 |

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `AUTH_SECRET` | 권장 | Auth.js 시크릿 (없으면 개발용 고정값) |
| `GITHUB_ID` | 선택 | GitHub OAuth Client ID |
| `GITHUB_SECRET` | 선택 | GitHub OAuth Client Secret |
| `AUTH_URL` | 선택 | 예: `http://localhost:3000` |

## 프로젝트 구조 (요약)

```
src/
  app/(app)/     # 인증 필요 페이지
  app/api/       # REST API
  components/    # UI · 기능 컴포넌트
  lib/           # auth, db, meta, github
data/mymark.db   # 로컬 SQLite (gitignore)
```
