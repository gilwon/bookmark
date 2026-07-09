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

### 2026-07-09: MVP 구현 완료 (Worker)
- 로컬 SQLite `data/mymark.db`, 첫 import 시 CREATE TABLE IF NOT EXISTS.
- Auth: GitHub provider는 env 있을 때만, Credentials Dev Login 항상 활성.
- lucide-react v1에 Github 브랜드 아이콘 없음 → GitFork 사용.
- open-graph-scraper는 dynamic import, 실패 시 hostname 폴백.
- 페이지 에디터: debounce 1.5s + 수동 저장 버튼.
- 빌드 검증: `npx tsc --noEmit` 통과, `npm run build` 성공.
