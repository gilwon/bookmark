# Context Notes — MyMark

## 결정 사항

### 2026-07-09: 로컬 우선 스택
- 계획서는 Supabase Postgres를 권장하나, 현재 워크스페이스에 Supabase 인증/프로젝트가 없음.
- **MVP는 Drizzle ORM + better-sqlite3**로 로컬 실행 가능하게 구성.
- 테이블 컬럼은 계획서 모델과 동일하게 맞춤 (`bookmarks`, `github_stars`, `custom_pages`).
- Supabase 이전용 SQL은 `supabase/schema.sql`로 제공.

### 인증
- Auth.js(NextAuth v5) + GitHub Provider.
- `GITHUB_ID` / `GITHUB_SECRET` 없으면 개발용 "Dev Login" 허용 (로컬 데모).
- user_id는 세션 user.id 기준.

### UI
- 다크모드 기본 (`next-themes`, defaultTheme=dark).
- 사이드바: Bookmarks / GitHub Stars / Pages / 검색.
- shadcn/ui 스타일 카드 + CSS columns 또는 grid 레이아웃.

### 메타 추출
- 서버 사이드 `open-graph-scraper` (API Route 또는 Server Action).
- 실패 시 URL 호스트/path 기반 폴백 타이틀.

### 범위
- Phase 0~5 MVP 전부 구현 목표.
- v1 이후(AI 태그, 익스텐션, Export, 공유)는 제외.

### 2026-07-09: 구현 완료 및 검증
- Worker가 MVP 골격·기능 구현. Advisor가 tsc/build/API 스모크 검증.
- 스모크: Dev Login → 북마크 생성(example.com 메타 추출) → 페이지 생성 → search/stars/pages 200.
- 의도적 미구현/제한:
  - Tiptap 내 북마크·레포 커스텀 임베드 노드 없음 (기본 링크만).
  - 검색 날짜 필터 없음.
  - Star sync는 GitHub OAuth 세션의 access_token 필요.
- package name: `mymark`.

### 2026-07-09: 임베드 블록 + 날짜 필터
- Tiptap `embedBlock` atom 노드 + React NodeView 카드.
- 속성은 스냅샷(title/url/description/image/subtitle)으로 저장 → 원본 삭제 후에도 표시 유지.
- 에디터 툴바「임베드」피커로 북마크/Star 선택 삽입.
- 검색 `from`/`to`(YYYY-MM-DD) 쿼리, `inDateRange`로 createdAt 포함 범위 필터.
- 날짜만 넣어도 hasQuery로 결과 목록 표시.

### 2026-07-09: ThemeProvider script 경고
- React 19 + next-themes: 클라이언트 컴포넌트가 `<script>`를 렌더하면 콘솔 에러.
- next-themes 제거 → 자체 `ThemeProvider` + `useTheme`.
- FOUC 방지는 루트 layout의 `next/script` `beforeInteractive` 로 처리.

### 2026-07-09: 테마 토글 무반응 수정
- 원인 1: UI 전반에 `bg-zinc-950` 등 다크 하드코딩 → html.light만 바꿔도 화면 그대로.
- 원인 2: layout `html` className에 `dark` 고정 → React가 토글을 덮을 수 있음.
- 해결: CSS 변수 토큰(`background`, `card`, `muted`…) + 시맨틱 Tailwind 클래스.
- `@custom-variant dark (&:where(.dark, .dark *))` 로 class 기반 dark: 유틸 활성화.
- 사이드바는 `toggleTheme()` 사용.

### 2026-07-09: P1/P2
- GitHub access_token → `oauth_tokens` AES-GCM 암호 저장. 세션은 hasGithub/githubLogin만.
- 로그아웃 시 토큰 삭제. scope: read:user user:email.
- Stars: 자동동기화(empty), 필터, 진행 문구, unstar prune.
- 사이드바 아바타 + github.com/{login}.
- API PATCH/DELETE where에 userId 필수. requireUser 헬퍼.
- Supabase: RLS 정책 + MIGRATION.md (런타임은 여전히 SQLite).
- 프로덕션 Dev Login 기본 off.

### 2026-07-09: 에이전트 문서 보관함
- `agent_docs` 테이블: kind(skill|agents|claude|other), filename, title, description, markdown content.
- UI: /agent-docs 목록 + 템플릿 생성, /agent-docs/[id] 모노스페이스 Markdown 에디터(자동저장·복사·다운로드).
- 검색 type=agent-doc 연동.

### 2026-07-09: Supabase 연동 (방식 B 확정)
- **방식 B**: 직접 `DATABASE_URL`/Postgres 드라이버 없음. 서버에서 `@supabase/supabase-js` + `service_role` 로 PostgREST 호출.
- 분기: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → Supabase JS, 없으면 로컬 SQLite.
- 데이터 접근 단일 진입점: `src/lib/store` (`sqlite-store` / `supabase-store` 동일 API).
- 클라이언트: `src/lib/supabase/admin.ts` (서버 전용, 세션 persist 끔).
- Auth 는 계속 Auth.js. `user_id` = `session.user.id`. ownership 은 앱 코드에서 `eq(user_id)`.
- SQL: `supabase/schema.sql`, 가이드: `supabase/MIGRATION.md`.


### 2026-07-09: MVP 구현 완료 (Worker)
- 로컬 SQLite `data/mymark.db`, 첫 import 시 CREATE TABLE IF NOT EXISTS.
- Auth: GitHub provider는 env 있을 때만, Credentials Dev Login 항상 활성.
- lucide-react v1에 Github 브랜드 아이콘 없음 → GitFork 사용.
- open-graph-scraper는 dynamic import, 실패 시 hostname 폴백.
- 페이지 에디터: debounce 1.5s + 수동 저장 버튼.
- 빌드 검증: `npx tsc --noEmit` 통과, `npm run build` 성공.
